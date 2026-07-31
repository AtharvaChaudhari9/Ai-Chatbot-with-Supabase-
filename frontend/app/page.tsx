import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { signIn } from '@/auth';

export default function LandingPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#050505] text-neutral-200 px-4 overflow-hidden">
      {/* Decorative gradient background glows */}
      <div className="absolute top-[-20%] left-[-20%] h-[600px] w-[600px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] h-[600px] w-[600px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      {/* Main Container Card */}
      <div className="z-10 w-full max-w-md rounded-3xl border border-neutral-900 bg-neutral-950/60 p-8 shadow-2xl backdrop-blur-xl text-center">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg mb-4 ring-4 ring-indigo-950/50">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">
            Cognexa AI
          </h1>
          <p className="text-xs text-neutral-400 mt-3 leading-relaxed">
            Welcome to your intelligent workspace. Sign in to chat with Gemini, run local models, and organize documents.
          </p>
        </div>

        {/* Action Form triggers OIDC login */}
        <form
          action={async () => {
            'use server';
            await signIn('keycloak');
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white hover:bg-neutral-200 text-black py-3.5 text-sm font-semibold transition-all shadow-md cursor-pointer mt-6 hover:scale-[1.01]"
          >
            Get Started
            <ArrowRight className="w-4 h-4 text-black" />
          </button>
        </form>
      </div>

      {/* Footer copyright */}
      <span className="absolute bottom-4 text-[10px] text-neutral-600 font-medium select-none">
        &copy; {new Date().getFullYear()} Cognexa Inc. All rights reserved.
      </span>
    </main>
  );
}