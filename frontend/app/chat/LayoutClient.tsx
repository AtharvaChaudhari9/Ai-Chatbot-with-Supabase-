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
  children,
}: {
  chats: any[];
  userEmail?: string;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [model, setModelVal] = useState<ModelType>('gemini');
  const [localUrl, setLocalUrlVal] = useState('http://127.0.0.1:11434');
  const [localModel, setLocalModelVal] = useState('llama3.2');

  const [agents, setAgents] = useState<any[]>([]);
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [editAgentId, setEditAgentId] = useState<string | null>(null);

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

  return (
    <SidebarContext.Provider value={{ isOpen: sidebarOpen, toggle }}>
      <ModelContext.Provider value={{ model, setModel, localUrl, setLocalUrl, localModel, setLocalModel }}>
        <AgentContext.Provider value={{ agents, refreshAgents, openAgentModal }}>
          <div className="flex h-screen w-screen overflow-hidden bg-[#0a0a0a]">
            <Sidebar
              chats={chats}
              currentChatId={currentChatId}
              userEmail={userEmail}
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
