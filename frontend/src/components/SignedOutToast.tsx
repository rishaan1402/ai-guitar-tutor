"use client";

import { useEffect } from "react";
import { Toaster, toast } from "sonner";

/**
 * Loaded on demand (next/dynamic) the first time a take is graded after the
 * session expired, so sonner stays out of /practice's first load.
 * `nonce` changes for each new notice.
 */
export default function SignedOutToast({ nonce, signInHref }: { nonce: number; signInHref: string }) {
  useEffect(() => {
    if (!nonce) return;
    toast("You were signed out — this take wasn't saved to your progress.", {
      id: "signed-out",
      duration: 10000,
      action: {
        label: "Sign in",
        onClick: () => {
          window.location.href = signInHref;
        },
      },
    });
  }, [nonce, signInHref]);
  return (
    <Toaster
      theme="dark"
      position="bottom-center"
      toastOptions={{
        style: {
          background: "rgba(20,22,20,0.96)",
          color: "#f3ead8",
          border: "1px solid rgba(239,194,122,0.35)",
        },
      }}
    />
  );
}
