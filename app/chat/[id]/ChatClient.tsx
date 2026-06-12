'use client';

import React from 'react';
import ChatWindow from '@/components/ChatWindow';
import { useSidebar } from '../LayoutClient';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface ChatClientProps {
  chatId: string;
  chatTitle: string;
  initialMessages: Message[];
  initialPrompt?: string;
}

export default function ChatClient({
  chatId,
  chatTitle,
  initialMessages,
  initialPrompt,
}: ChatClientProps) {
  const { toggle } = useSidebar();

  return (
    <ChatWindow
      chatId={chatId}
      chatTitle={chatTitle}
      initialMessages={initialMessages}
      initialPrompt={initialPrompt}
      onMenuToggle={toggle}
    />
  );
}
