'use client';

import { signIn } from "next-auth/react";
import { useEffect } from "react";
import Link from "next/link";
import { Sparkles, KeyRound } from "lucide-react";

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
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#050505] text-neutral-400 px-4">
      {/* Decorative gradient background glows */}
      <div className="absolute top-[-20%] left-[-20%] h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      <div className="z-10 flex flex-col items-center gap-4 text-center max-w-sm rounded-3xl border border-neutral-900 bg-neutral-950/60 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg ring-4 ring-indigo-950/50">
          <Sparkles className="w-6 h-6 text-white" />
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold text-white">Cognexa AI</h1>
          <p className="text-xs text-neutral-400">Connecting to secure authentication service...</p>
        </div>

        <div className="flex items-center gap-2 text-violet-400 text-xs py-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <span>Authenticating</span>
        </div>

        <div className="pt-2 border-t border-neutral-900 w-full text-center">
          <Link
            href="/"
            className="text-xs text-neutral-400 hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer hover:underline"
          >
            <KeyRound className="w-3.5 h-3.5 text-violet-400" />
            Return to Cognexa Home / Reset Password
          </Link>
        </div>
      </div>
    </div>
  );
}
