'use client';

import { signIn } from "next-auth/react";
import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    // Clear residual 2FA verification states on new login session
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('mfa_verified');
    }
    // Automatically trigger sign-in with Keycloak on mount
    signIn("keycloak", { callbackUrl: "/chat" });
  }, []);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-black text-neutral-400">
      <div className="flex flex-col items-center gap-2">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-500 border-t-transparent" />
        <p className="text-xs">Redirecting to secure login...</p>
      </div>
    </div>
  );
}
