'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sparkles, Loader2, Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check if session already exists, redirect to chat dashboard if authenticated
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.push('/chat');
      }
    };
    checkUser();
  }, [router, supabase]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Handle Email sign up
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (signUpError) throw signUpError;
        setSuccess('Account created! Please check your email inbox to confirm registration.');
      } else {
        // Handle Email login
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });

        if (signInError) throw signInError;
        
        router.push('/chat');
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#050505] text-neutral-200 px-4 overflow-hidden">
      
      {/* Decorative gradient background glows */}
      <div className="absolute top-[-20%] left-[-20%] h-[600px] w-[600px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] h-[600px] w-[600px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      {/* Main Container Card */}
      <div className="z-10 w-full max-w-md rounded-3xl border border-neutral-900 bg-neutral-950/60 p-8 shadow-2xl backdrop-blur-xl">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg mb-4">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-neutral-50 via-neutral-200 to-neutral-500 bg-clip-text text-transparent">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            {isSignUp 
              ? 'Sign up to start chatting with Gemini AI' 
              : 'Sign in to access your previous conversations'}
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-950/40 bg-red-950/15 p-3.5 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-950/40 bg-emerald-950/15 p-3.5 text-xs text-emerald-400">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="font-medium">{success}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 w-4.5 h-4.5 text-neutral-600" />
              <input
                type="email"
                required
                disabled={loading}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-neutral-900 bg-neutral-900/40 pl-11 pr-4 py-3 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-800 focus:outline-none transition-colors disabled:opacity-55"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-4.5 h-4.5 text-neutral-600" />
              <input
                type="password"
                required
                disabled={loading}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-neutral-900 bg-neutral-900/40 pl-11 pr-4 py-3 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-800 focus:outline-none transition-colors disabled:opacity-55"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white hover:bg-neutral-200 text-black py-3 text-sm font-semibold transition-all shadow-md disabled:opacity-55 mt-6 cursor-pointer"
          >
            {loading && <Loader2 className="w-4.5 h-4.5 animate-spin" />}
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        {/* Toggle between login / register */}
        <div className="mt-6 text-center text-xs">
          <span className="text-neutral-500">
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          </span>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setSuccess(null);
            }}
            className="text-indigo-400 hover:text-indigo-300 font-semibold focus:outline-none transition-colors cursor-pointer"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>

      </div>

      {/* Footer copyright */}
      <span className="absolute bottom-4 text-[10px] text-neutral-600 font-medium select-none">
        &copy; {new Date().getFullYear()} Gemini Chatbot Inc. All rights reserved.
      </span>

    </main>
  );
}