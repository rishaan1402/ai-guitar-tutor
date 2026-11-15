"use client";

import { useEffect, useRef, useState } from "react";
import { getSocialProviders, type SocialProvider, type SocialProviders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

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
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    providersOnce ??= getSocialProviders();
    let live = true;
    providersOnce.then((p) => live && setProviders(p));
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

  // Google renders its own button (its brand rules); we just give it a slot.
  const googleId = providers.google?.client_id;
  useEffect(() => {
    if (!googleId || !googleEl.current) return;
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
      {googleId && <div ref={googleEl} className="flex min-h-[44px] w-full justify-center" data-testid="google-signin" />}
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
