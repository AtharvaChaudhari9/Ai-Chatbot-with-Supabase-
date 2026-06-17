'use client';

import React, { useState, createContext, useContext, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { usePathname } from 'next/navigation';

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

  const pathname = usePathname();
  const pathParts = pathname.split('/');
  const currentChatId = pathParts[2]; // e.g., /chat/[id]

  const toggle = () => setSidebarOpen((prev) => !prev);

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
      </ModelContext.Provider>
    </SidebarContext.Provider>
  );
}
