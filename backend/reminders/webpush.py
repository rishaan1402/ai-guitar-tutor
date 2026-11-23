"""Web Push, sent ourselves: RFC 8291 message encryption (aes128gcm) and
RFC 8292 VAPID authentication, with the cryptography and PyJWT packages the
app already uses (pywebpush's native dependency doesn't build everywhere).

VAPID_PRIVATE_KEY is the server's P-256 private key as base64url of the raw
32 bytes; the browser subscribes with the matching public key.
"""
from __future__ import annotations

import base64
import json
import os
import struct
import time
from typing import Optional
from urllib.parse import urlsplit

import httpx
import jwt
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


def b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def b64u_decode(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _raw_public(key: ec.EllipticCurvePublicKey) -> bytes:
    return key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)


def _hkdf(salt: bytes, ikm: bytes, info: bytes, length: int) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=length, salt=salt, info=info).derive(ikm)


def encrypt(payload: bytes, p256dh: str, auth: str, salt: Optional[bytes] = None,
            server_key: Optional[ec.EllipticCurvePrivateKey] = None) -> bytes:
    """One aes128gcm record for a browser's subscription keys (RFC 8291)."""
    ua_public = b64u_decode(p256dh)
    ua_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), ua_public)
    as_key = server_key or ec.generate_private_key(ec.SECP256R1())
    as_public = _raw_public(as_key.public_key())
    shared = as_key.exchange(ec.ECDH(), ua_key)
    ikm = _hkdf(b64u_decode(auth), shared, b"WebPush: info\x00" + ua_public + as_public, 32)
    salt = salt or os.urandom(16)
    cek = _hkdf(salt, ikm, b"Content-Encoding: aes128gcm\x00", 16)
    nonce = _hkdf(salt, ikm, b"Content-Encoding: nonce\x00", 12)
    ciphertext = AESGCM(cek).encrypt(nonce, payload + b"\x02", None)
    return salt + struct.pack("!IB", 4096, len(as_public)) + as_public + ciphertext


def vapid_private_key() -> Optional[ec.EllipticCurvePrivateKey]:
    raw = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
    if not raw:
        return None
    return ec.derive_private_key(int.from_bytes(b64u_decode(raw), "big"), ec.SECP256R1())


def vapid_public_key() -> Optional[str]:
    key = vapid_private_key()
    return b64u(_raw_public(key.public_key())) if key else None


def vapid_headers(endpoint: str, key: ec.EllipticCurvePrivateKey, subject: str) -> dict[str, str]:
    """Authorization for the push service of `endpoint` (RFC 8292)."""
    parts = urlsplit(endpoint)
    token = jwt.encode(
        {"aud": f"{parts.scheme}://{parts.netloc}", "exp": int(time.time()) + 12 * 3600, "sub": subject},
        key,
        algorithm="ES256",
    )
    return {"Authorization": f"vapid t={token}, k={b64u(_raw_public(key.public_key()))}"}


async def send(endpoint: str, p256dh: str, auth: str, message: dict, *, ttl: int = 6 * 3600,
               client: Optional[httpx.AsyncClient] = None) -> int:
    """Deliver one notification; returns the push service's status code
    (201 delivered; 404 or 410 means the subscription is gone)."""
    key = vapid_private_key()
    if key is None:
        raise RuntimeError("VAPID_PRIVATE_KEY is not set")
    subject = os.environ.get("VAPID_SUBJECT") or os.environ.get("FRONTEND_URL") or "https://ai-guitar-tutor.vercel.app"
    body = encrypt(json.dumps(message).encode(), p256dh, auth)
    headers = {
        **vapid_headers(endpoint, key, subject),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        "TTL": str(ttl),
        "Urgency": "normal",
    }
    own = client is None
    client = client or httpx.AsyncClient(timeout=10)
    try:
        resp = await client.post(endpoint, content=body, headers=headers)
        return resp.status_code
    finally:
        if own:
            await client.aclose()
