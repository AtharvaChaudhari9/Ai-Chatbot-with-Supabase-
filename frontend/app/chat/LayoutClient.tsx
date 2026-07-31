'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import AgentModal from '@/components/AgentModal';
import MultiAgentBar from '@/components/MultiAgentBar';
import DynamicHeader from '@/components/DynamicHeader';
import { Sparkles, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { notifyLoginSuccess } from '@/components/SessionSync';

// Context Exports
interface SidebarContextType {
  isOpen: boolean;
  toggle: () => void;
}

interface ModelContextType {
  model: string;
  setModel: (m: string) => void;
  localUrl: string;
  setLocalUrl: (url: string) => void;
  localModel: string;
  setLocalModel: (m: string) => void;
}

interface AgentContextType {
  agents: any[];
  refreshAgents: () => void;
  openAgentModal: (id?: string) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isOpen: false,
  toggle: () => {},
});

const ModelContext = createContext<ModelContextType>({
  model: 'gemini-1.5-flash',
  setModel: () => {},
  localUrl: 'http://localhost:11434',
  setLocalUrl: () => {},
  localModel: '',
  setLocalModel: () => {},
});

const AgentContext = createContext<AgentContextType>({
  agents: [],
  refreshAgents: () => {},
  openAgentModal: () => {},
});

export const useSidebar = () => useContext(SidebarContext);
export const useModel = () => useContext(ModelContext);
export const useAgent = () => useContext(AgentContext);
export const useAgents = () => useContext(AgentContext);

interface LayoutClientProps {
  children: React.ReactNode;
  chats: any[];
  currentChatId?: string;
  userEmail?: string;
  defaultName?: string;
  defaultImage?: string;
  initialNickname?: string;
  initialAvatarUrl?: string;
  initialMfaEnabled?: boolean;
}

export default function LayoutClient({
  children,
  chats,
  currentChatId,
  userEmail = 'user@cognexa.ai',
  defaultName = 'User',
  defaultImage = '',
  initialNickname,
  initialAvatarUrl,
  initialMfaEnabled = false,
}: LayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  const [model, setModel] = useState('gemini-1.5-flash');
  const [localUrl, setLocalUrl] = useState('http://localhost:11434');
  const [localModel, setLocalModel] = useState('');

  const [agents, setAgents] = useState<any[]>([]);
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [editAgentId, setEditAgentId] = useState<string | null>(null);

  // MFA states with localStorage support for multi-tab persistence
  const [isMfaEnabled, setIsMfaEnabled] = useState(initialMfaEnabled);
  const [mfaVerified, setMfaVerified] = useState(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('mfa_verified') === 'true' ||
        sessionStorage.getItem('mfa_verified') === 'true'
      );
    }
    return false;
  });
  const [isMfaLoading, setIsMfaLoading] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // Sync mfaVerified across tabs on storage events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'mfa_verified' && e.newValue === 'true') {
        setMfaVerified(true);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const checkMfaStatus = async () => {
    try {
      const res = await fetch('/api/user/profile');
      if (res.ok) {
        const data = await res.json();
        setIsMfaEnabled(data.mfaEnabled || false);
      }
    } catch (e) {
      console.error('Failed to load profile details:', e);
    } finally {
      setIsMfaLoading(false);
    }
  };

  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setOtpError('Please enter a 6-digit code.');
      return;
    }
    setOtpError('');
    setIsVerifyingOtp(true);
    try {
      const res = await fetch('/api/user/mfa/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpCode }),
      });
      if (res.ok) {
        localStorage.setItem('mfa_verified', 'true');
        sessionStorage.setItem('mfa_verified', 'true');
        setMfaVerified(true);
        notifyLoginSuccess();
      } else {
        const data = await res.json();
        setOtpError(data.error || 'Invalid code. Please try again.');
      }
    } catch (e) {
      console.error(e);
      setOtpError('An error occurred. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAgents();
    checkMfaStatus();
  }, []);

  const openAgentModal = (id?: string) => {
    setEditAgentId(id || null);
    setAgentModalOpen(true);
  };

  // If MFA is enabled on user account but NOT yet verified in browser, render MFA verification overlay
  if (isMfaEnabled && !mfaVerified) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#050505] text-neutral-400 px-4">
        <div className="absolute top-[-20%] left-[-20%] h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

        <div className="z-10 flex flex-col items-center gap-5 text-center max-w-md w-full rounded-3xl border border-neutral-900 bg-neutral-950/80 p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg ring-4 ring-indigo-950/50">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-white">Two-Factor Authentication Required</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Enter the 6-digit verification code from your authenticator app to complete access to Cognexa AI.
            </p>
          </div>

          <form onSubmit={handleVerifyLoginOtp} className="w-full space-y-4 pt-2">
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                6-Digit Authenticator Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                autoFocus
                className="w-full tracking-widest text-center text-lg font-mono rounded-xl border border-neutral-800 bg-neutral-900/60 py-3.5 text-white placeholder-neutral-700 focus:border-violet-500 focus:outline-none transition-colors"
              />
            </div>

            {otpError && (
              <p className="text-xs text-red-400 bg-red-950/30 border border-red-950/50 rounded-lg p-2.5">
                {otpError}
              </p>
            )}

            <button
              type="submit"
              disabled={isVerifyingOtp || otpCode.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 text-xs font-semibold transition-all shadow-md cursor-pointer"
            >
              {isVerifyingOtp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <span>Verify & Proceed to Cognexa</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <SidebarContext.Provider value={{ isOpen: sidebarOpen, toggle: toggleSidebar }}>
      <ModelContext.Provider value={{ model, setModel, localUrl, setLocalUrl, localModel, setLocalModel }}>
        <AgentContext.Provider value={{ agents, refreshAgents: fetchAgents, openAgentModal }}>
          <div className="flex h-screen w-screen overflow-hidden bg-black text-white font-sans antialiased">
            {sidebarOpen && (
              <div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            <div className="flex flex-1 overflow-hidden relative">
              <Sidebar
                chats={chats}
                currentChatId={currentChatId}
                userEmail={userEmail}
                defaultName={defaultName}
                defaultImage={defaultImage}
                initialNickname={initialNickname}
                initialAvatarUrl={initialAvatarUrl}
                initialMfaEnabled={initialMfaEnabled}
                onMfaEnabled={() => {
                  setIsMfaEnabled(true);
                  localStorage.setItem('mfa_verified', 'true');
                  sessionStorage.setItem('mfa_verified', 'true');
                  setMfaVerified(true);
                }}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
              />
              <main className="flex flex-1 flex-col h-full overflow-hidden min-w-0">
                {children}
              </main>
            </div>
            <AgentModal
              isOpen={agentModalOpen}
              onClose={() => setAgentModalOpen(false)}
              agentId={editAgentId}
              onAgentSaved={fetchAgents}
            />
          </div>
        </AgentContext.Provider>
      </ModelContext.Provider>
    </SidebarContext.Provider>
  );
}
