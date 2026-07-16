'use client';

import React, { useState, createContext, useContext, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { usePathname } from 'next/navigation';
import AgentModal from '@/components/AgentModal';

interface SidebarContextType {
  isOpen: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isOpen: false,
  toggle: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export type ModelType = 'gemini' | 'local';

interface ModelContextType {
  model: ModelType;
  setModel: (model: ModelType) => void;
  localUrl: string;
  setLocalUrl: (url: string) => void;
  localModel: string;
  setLocalModel: (model: string) => void;
}

const ModelContext = createContext<ModelContextType>({
  model: 'gemini',
  setModel: () => {},
  localUrl: 'http://127.0.0.1:11434',
  setLocalUrl: () => {},
  localModel: 'llama3.2',
  setLocalModel: () => {},
});

export const useModel = () => useContext(ModelContext);

interface AgentContextType {
  agents: any[];
  refreshAgents: () => void;
  openAgentModal: (agentId?: string | null) => void;
}

const AgentContext = createContext<AgentContextType>({
  agents: [],
  refreshAgents: () => {},
  openAgentModal: () => {},
});

export const useAgent = () => useContext(AgentContext);

export default function ChatLayoutClient({
  chats,
  userEmail,
  initialNickname,
  initialAvatarUrl,
  initialMfaEnabled,
  children,
}: {
  chats: any[];
  userEmail?: string;
  initialNickname: string | null;
  initialAvatarUrl: string | null;
  initialMfaEnabled: boolean;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [model, setModelVal] = useState<ModelType>('gemini');
  const [localUrl, setLocalUrlVal] = useState('http://127.0.0.1:11434');
  const [localModel, setLocalModelVal] = useState('llama3.2');

  const [agents, setAgents] = useState<any[]>([]);
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [editAgentId, setEditAgentId] = useState<string | null>(null);

  // MFA states and verifications
  const [isMfaEnabled, setIsMfaEnabled] = useState(initialMfaEnabled);
  const [mfaVerified, setMfaVerified] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('mfa_verified') === 'true';
    }
    return false;
  });
  const [isMfaLoading, setIsMfaLoading] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

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
        sessionStorage.setItem('mfa_verified', 'true');
        setMfaVerified(true);
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

  const pathname = usePathname();
  const pathParts = pathname.split('/');
  const currentChatId = pathParts[2]; // e.g., /chat/[id]

  const toggle = () => setSidebarOpen((prev) => !prev);

  const refreshAgents = async () => {
    try {
      const response = await fetch('/api/agents');
      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error('Failed to fetch agents in layout:', err);
    }
  };

  const openAgentModal = (agentId?: string | null) => {
    setEditAgentId(agentId || null);
    setAgentModalOpen(true);
  };

  // Safely initialize values from localStorage on mount
  useEffect(() => {
    const savedModel = localStorage.getItem('chat-model-preference');
    if (savedModel === 'gemini' || savedModel === 'local') {
      setModelVal(savedModel);
    }
    const savedUrl = localStorage.getItem('chat-local-url');
    if (savedUrl) {
      setLocalUrlVal(savedUrl);
    }
    const savedModelName = localStorage.getItem('chat-local-model');
    if (savedModelName) {
      setLocalModelVal(savedModelName);
    }
    
    refreshAgents();
    checkMfaStatus();
  }, []);

  const setModel = (val: ModelType) => {
    setModelVal(val);
    localStorage.setItem('chat-model-preference', val);
  };

  const setLocalUrl = (val: string) => {
    setLocalUrlVal(val);
    localStorage.setItem('chat-local-url', val);
  };

  const setLocalModel = (val: string) => {
    setLocalModelVal(val);
    localStorage.setItem('chat-local-model', val);
  };

  if (isMfaEnabled && !mfaVerified && !isMfaLoading) {
    return (
      <div className="relative flex h-screen w-screen items-center justify-center bg-[#050505] text-neutral-200 px-4 overflow-hidden select-none font-sans">
        {/* Glowing background spotlights */}
        <div className="absolute top-[-20%] left-[-20%] h-[600px] w-[600px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-20%] h-[600px] w-[600px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none"></div>

        {/* Centered MFA Verification Card */}
        <div className="z-10 w-full max-w-sm rounded-3xl border border-neutral-900 bg-neutral-950/60 p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col items-center mb-6">
            {/* Visual lock icon */}
            <div className="h-12 w-12 rounded-2xl bg-indigo-650/10 border border-indigo-500/20 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="w-5 h-5 text-indigo-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">Two-Factor Authentication</h3>
            <p className="text-[10px] text-neutral-500 text-center mt-2.5 font-semibold leading-relaxed">
              Enter the 6-digit verification code from your Google Authenticator app to unlock your chatbot account.
            </p>
          </div>

          <form onSubmit={handleVerifyLoginOtp} className="space-y-4">
            <div className="space-y-1.5">
              <input
                type="text"
                maxLength={6}
                pattern="[0-9]*"
                inputMode="numeric"
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full text-center tracking-[0.75em] text-lg font-bold rounded-xl border border-neutral-900 bg-neutral-900/40 py-3 text-neutral-200 placeholder-neutral-800 focus:border-neutral-800 focus:outline-none transition-colors"
                autoFocus
              />
            </div>

            {otpError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-950/40 bg-red-950/15 text-red-400 p-3 text-[10px] font-semibold leading-relaxed animate-in fade-in duration-200">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="w-4 h-4 shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                <span>{otpError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifyingOtp}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-650 hover:bg-indigo-600 text-xs text-white py-3 transition-colors font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50"
            >
              {isVerifyingOtp ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Verifying...
                </>
              ) : (
                'Verify & Unlock'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <SidebarContext.Provider value={{ isOpen: sidebarOpen, toggle }}>
      <ModelContext.Provider value={{ model, setModel, localUrl, setLocalUrl, localModel, setLocalModel }}>
        <AgentContext.Provider value={{ agents, refreshAgents, openAgentModal }}>
          <div className="flex h-screen w-screen overflow-hidden bg-[#0a0a0a]">
            <Sidebar
              chats={chats}
              currentChatId={currentChatId}
              userEmail={userEmail}
              initialNickname={initialNickname}
              initialAvatarUrl={initialAvatarUrl}
              initialMfaEnabled={initialMfaEnabled}
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />
            <main className="flex flex-1 flex-col h-full overflow-hidden">
              {children}
            </main>
          </div>
          <AgentModal
            isOpen={agentModalOpen}
            onClose={() => setAgentModalOpen(false)}
            agentId={editAgentId}
            onSaveSuccess={refreshAgents}
          />
        </AgentContext.Provider>
      </ModelContext.Provider>
    </SidebarContext.Provider>
  );
}
