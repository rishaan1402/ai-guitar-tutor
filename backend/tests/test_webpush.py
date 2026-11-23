"""Web Push encryption and VAPID, checked the way a browser and a push service would."""
from __future__ import annotations

import asyncio
import json
import os
import struct

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from reminders import webpush as wp


def _browser():
    key = ec.generate_private_key(ec.SECP256R1())
    raw = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    auth = os.urandom(16)
    return key, wp.b64u(raw), wp.b64u(auth)


def _decrypt(body: bytes, ua_key, p256dh: str, auth: str) -> bytes:
    """What the browser does with the message (RFC 8291 section 3 / RFC 8188)."""
    salt, (rs, idlen) = body[:16], struct.unpack("!IB", body[16:21])
    as_public = body[21:21 + idlen]
    ciphertext = body[21 + idlen:]
    as_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), as_public)
    shared = ua_key.exchange(ec.ECDH(), as_key)
    ikm = wp._hkdf(wp.b64u_decode(auth), shared, b"WebPush: info\x00" + wp.b64u_decode(p256dh) + as_public, 32)
    cek = wp._hkdf(salt, ikm, b"Content-Encoding: aes128gcm\x00", 16)
    nonce = wp._hkdf(salt, ikm, b"Content-Encoding: nonce\x00", 12)
    plain = AESGCM(cek).decrypt(nonce, ciphertext, None)
    assert rs == 4096 and plain.endswith(b"\x02")
    return plain[:-1]


def test_browser_can_decrypt_the_message():
    ua_key, p256dh, auth = _browser()
    msg = b'{"title":"Time to play","body":"Your 6-day streak is waiting"}'
    body = wp.encrypt(msg, p256dh, auth)
    assert _decrypt(body, ua_key, p256dh, auth) == msg
    assert wp.encrypt(msg, p256dh, auth) != body  # fresh salt and key every time


def test_vapid_header_is_a_valid_es256_token_for_the_push_service(monkeypatch):
    server = ec.generate_private_key(ec.SECP256R1())
    d = server.private_numbers().private_value.to_bytes(32, "big")
    monkeypatch.setenv("VAPID_PRIVATE_KEY", wp.b64u(d))
    key = wp.vapid_private_key()
    header = wp.vapid_headers("https://fcm.googleapis.com/fcm/send/abc", key, "https://example.app")["Authorization"]
    token = header.split("t=")[1].split(",")[0]
    k = header.split("k=")[1]
    assert k == wp.vapid_public_key()
    pub = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), wp.b64u_decode(k))
    claims = jwt.decode(token, pub, algorithms=["ES256"], audience="https://fcm.googleapis.com")
    assert claims["sub"] == "https://example.app"


def test_send_posts_an_encrypted_body(monkeypatch):
    server = ec.generate_private_key(ec.SECP256R1())
    monkeypatch.setenv("VAPID_PRIVATE_KEY", wp.b64u(server.private_numbers().private_value.to_bytes(32, "big")))
    ua_key, p256dh, auth = _browser()
    seen = {}

    class _Http:
        async def post(self, url, content, headers):
            seen.update(url=url, body=content, headers=headers)
            return type("R", (), {"status_code": 201})()

    status = asyncio.run(wp.send("https://push.example/sub/1", p256dh, auth, {"title": "Hi"}, client=_Http()))
    assert status == 201 and seen["headers"]["Content-Encoding"] == "aes128gcm"
    assert json.loads(_decrypt(seen["body"], ua_key, p256dh, auth)) == {"title": "Hi"}
