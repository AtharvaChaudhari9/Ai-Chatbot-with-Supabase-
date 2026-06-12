'use client';

import React, { useState, createContext, useContext } from 'react';
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
  const pathname = usePathname();
  const pathParts = pathname.split('/');
  const currentChatId = pathParts[2]; // e.g., /chat/[id]

  const toggle = () => setSidebarOpen((prev) => !prev);

  return (
    <SidebarContext.Provider value={{ isOpen: sidebarOpen, toggle }}>
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
    </SidebarContext.Provider>
  );
}
