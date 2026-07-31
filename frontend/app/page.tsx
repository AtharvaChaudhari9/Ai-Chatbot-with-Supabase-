'use client';

import React, { useState } from 'react';
import { Sparkles, ArrowRight, KeyRound, X, CheckCircle2, AlertCircle, Loader2, Mail, Lock } from 'lucide-react';
import { signIn } from 'next-auth/react';

export default function LandingPage() {
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleOpenForgot = () => {
    setIsForgotOpen(true);
    setError(null);
    setSuccessMessage(null);
    setEmail('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleCloseForgot = () => {
    setIsForgotOpen(false);
    setError(null);
    setSuccessMessage(null);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please check and try again.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password.');
      }

      setSuccessMessage(data.message || 'Password reset successfully!');
    } catch (err: any) {
      setError(err.message || 'An error occurred while resetting your password.');
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
      <div className="z-10 w-full max-w-md rounded-3xl border border-neutral-900 bg-neutral-950/60 p-8 shadow-2xl backdrop-blur-xl text-center">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg mb-4 ring-4 ring-indigo-950/50">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Cognexa AI
          </h1>
          <p className="text-xs text-neutral-400 mt-3 leading-relaxed">
            Welcome to your intelligent workspace. Sign in to chat with Gemini, run local models, and organize documents.
          </p>
        </div>

        {/* Action Button triggers Cognexa OIDC login */}
        <button
          onClick={() => signIn('keycloak', { callbackUrl: '/chat' })}
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white hover:bg-neutral-200 text-black py-3.5 text-sm font-semibold transition-all shadow-md cursor-pointer mt-6 hover:scale-[1.01]"
        >
          Get Started
          <ArrowRight className="w-4 h-4 text-black" />
        </button>

        {/* Forgot Password option */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleOpenForgot}
            className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer hover:underline"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Forgot password?
          </button>
        </div>
      </div>

      {/* Cognexa-Themed In-App Forgot Password Modal */}
      {isForgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-7 shadow-2xl text-left">
            {/* Modal Close Button */}
            <button
              onClick={handleCloseForgot}
              className="absolute top-5 right-5 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-900 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-md">
                <KeyRound className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Reset Your Password</h2>
                <p className="text-xs text-neutral-400">Update your account credentials inside Cognexa</p>
              </div>
            </div>

            {/* Success State */}
            {successMessage ? (
              <div className="flex flex-col items-center text-center py-4 space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 ring-4 ring-emerald-500/20">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-white">Password Updated</h3>
                  <p className="text-xs text-neutral-300 leading-relaxed">{successMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleCloseForgot();
                    signIn('keycloak', { callbackUrl: '/chat' });
                  }}
                  className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 text-white py-3 text-xs font-semibold transition-all shadow-md mt-2 cursor-pointer"
                >
                  Proceed to Login
                </button>
              </div>
            ) : (
              /* Password Reset Form */
              <form onSubmit={handleResetPassword} className="space-y-4">
                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Account Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseForgot}
                    className="rounded-xl border border-neutral-800 hover:bg-neutral-900 text-neutral-300 px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-5 py-2.5 text-xs font-semibold transition-all shadow-md cursor-pointer"
                  >
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {loading ? 'Updating Password...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer copyright */}
      <span className="absolute bottom-4 text-[10px] text-neutral-600 font-medium select-none">
        &copy; {new Date().getFullYear()} Cognexa Inc. All rights reserved.
      </span>
    </main>
  );
}