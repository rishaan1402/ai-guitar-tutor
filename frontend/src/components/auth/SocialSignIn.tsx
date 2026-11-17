"use client";

import { useEffect, useRef, useState } from "react";
import { getSocialProviders, type SocialProvider, type SocialProviders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Capacitor } from "@capacitor/core";
import { isNativeApp } from "@/lib/native";

/** Android app: the provider's native sign-in (Google blocks its web sign-in inside app WebViews). */
async function nativeToken(provider: SocialProvider, p: SocialProviders): Promise<string> {
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  await SocialLogin.initialize({
    ...(p.google ? { google: { webClientId: p.google.client_id } } : {}),
    ...(p.facebook ? { facebook: { appId: p.facebook.app_id, clientToken: p.facebook.client_token } } : {}),
  });
  if (provider === "google") {
    const res = await SocialLogin.login({ provider: "google", options: { scopes: ["email", "profile"] } });
    const token = "idToken" in res.result ? res.result.idToken : null;
    if (!token) throw new Error("Google didn't return a sign-in token");
    return token;
  }
  const res = await SocialLogin.login({ provider: "facebook", options: { permissions: ["email", "public_profile"] } });
  const token = res.result.accessToken?.token;
  if (!token) throw new Error("Facebook didn't return a sign-in token");
  return token;
}

/* Minimal typings for the two provider SDKs loaded below. */
interface GoogleId {
  initialize(cfg: { client_id: string; callback: (r: { credential?: string }) => void; ux_mode?: "popup"; auto_select?: boolean }): void;
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
}
interface FacebookSdk {
  init(cfg: { appId: string; version: string; cookie?: boolean; xfbml?: boolean }): void;
  login(cb: (r: { authResponse?: { accessToken: string } | null; status?: string }) => void, opts: { scope: string }): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

const scripts = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  if (!scripts.has(src)) {
    scripts.set(
      src,
      new Promise((resolve, reject) => {
        const el = document.createElement("script");
        el.src = src;
        el.async = true;
        el.defer = true;
        el.onload = () => resolve();
        el.onerror = () => {
          scripts.delete(src);
          reject(new Error(`Couldn't load ${new URL(src).host}`));
        };
        document.head.appendChild(el);
      }),
    );
  }
  return scripts.get(src)!;
}

let providersOnce: Promise<SocialProviders> | null = null;

interface Props {
  /** Where to go after signing in. */
  onDone: () => void;
  /** "Continue with…" on both pages; only the divider text changes. */
  mode: "login" | "signup";
}

/**
 * "Continue with Google / Facebook". Renders nothing until the server says a
 * provider is configured, so the page never shows a button that can't work.
 */
export default function SocialSignIn({ onDone, mode }: Props) {
  const { socialSignIn } = useAuth();
  const [providers, setProviders] = useState<SocialProviders>({});
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const googleEl = useRef<HTMLDivElement>(null);
  const native = isNativeApp();
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    providersOnce ??= getSocialProviders();
    let live = true;
    // iOS app: Google and Facebook need their own iOS app IDs (not set up yet), so only
    // email sign-in is offered there for now
    const ios = native && Capacitor.getPlatform() === "ios";
    providersOnce.then((p) => live && setProviders(ios ? {} : p));
    return () => {
      live = false;
    };
  }, []);

  async function finish(provider: SocialProvider, token: string) {
    setBusy(provider);
    setError(null);
    try {
      await socialSignIn(provider, token);
      doneRef.current();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(null);
    }
  }

  async function nativeSignIn(provider: SocialProvider) {
    setError(null);
    try {
      const token = await nativeToken(provider, providers);
      await finish(provider, token);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(/cancel/i.test(msg) ? `${provider === "google" ? "Google" : "Facebook"} sign-in was cancelled` : msg || "Sign-in failed");
    }
  }

  // Google renders its own button on the web (its brand rules); we just give it a slot.
  const googleId = providers.google?.client_id;
  useEffect(() => {
    if (!googleId || !googleEl.current || native) return;
    let live = true;
    loadScript("https://accounts.google.com/gsi/client")
      .then(() => {
        if (!live || !window.google || !googleEl.current) return;
        window.google.accounts.id.initialize({
          client_id: googleId,
          ux_mode: "popup",
          callback: (r) => {
            if (r.credential) finish("google", r.credential);
            else setError("Google sign-in was cancelled");
          },
        });
        window.google.accounts.id.renderButton(googleEl.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: Math.min(googleEl.current.offsetWidth || 320, 400),
        });
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleId]);

  const fbAppId = providers.facebook?.app_id;
  async function facebook() {
    if (!fbAppId) return;
    if (native) return nativeSignIn("facebook");
    setError(null);
    try {
      let fb = window.FB;
      if (!fb) {
        await loadScript("https://connect.facebook.net/en_US/sdk.js");
        fb = window.FB;
        if (!fb) throw new Error("Facebook sign-in didn't load");
        fb.init({ appId: fbAppId, version: "v19.0", cookie: false, xfbml: false });
      }
      fb.login(
        (r) => {
          if (r.authResponse?.accessToken) finish("facebook", r.authResponse.accessToken);
          else setError("Facebook sign-in was cancelled");
        },
        { scope: "public_profile,email" },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open Facebook sign-in");
    }
  }

  if (!googleId && !fbAppId) return null;

  return (
    <div className="space-y-3" aria-busy={busy !== null}>
      {googleId && !native && <div ref={googleEl} className="flex min-h-[44px] w-full justify-center" data-testid="google-signin" />}
      {googleId && native && (
        <button
          type="button"
          onClick={() => nativeSignIn("google")}
          disabled={busy !== null}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-[#8e918f] bg-[#131314] px-4 text-sm font-medium text-[#e3e3e3] disabled:opacity-60"
        >
          <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          {busy === "google" ? "Signing in…" : "Continue with Google"}
        </button>
      )}
      {fbAppId && (
        <button
          type="button"
          onClick={facebook}
          disabled={busy !== null}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-full bg-[#1877F2] px-4 text-sm font-semibold text-white transition hover:bg-[#166fe0] disabled:opacity-60"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-white">
            <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
          </svg>
          {busy === "facebook" ? "Signing in…" : "Continue with Facebook"}
        </button>
      )}
      {busy === "google" && <p className="text-center text-sm text-cream/60" role="status">Signing in with Google…</p>}
      {error && (
        <p className="text-center text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3 pt-1 text-xs uppercase tracking-wider text-cream/40" aria-hidden="true">
        <span className="h-px flex-1 bg-cream/10" />
        {mode === "signup" ? "or sign up with email" : "or log in with email"}
        <span className="h-px flex-1 bg-cream/10" />
      </div>
    </div>
  );
}
