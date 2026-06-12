'use client';

import React, { useState, useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import PromptInput from './PromptInput';
import { Menu, Sparkles, Loader2, Compass, PenTool, Code, AlertCircle } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface ChatWindowProps {
  chatId: string;
  chatTitle: string;
  initialMessages: Message[];
  onMenuToggle: () => void;
  initialPrompt?: string;
}

const SUGGESTIONS = [
  {
    icon: Compass,
    title: 'Explore ideas',
    desc: 'Explain quantum computing in simple terms',
    prompt: 'Explain quantum computing in simple terms, using a creative analogy.'
  },
  {
    icon: PenTool,
    title: 'Draft content',
    desc: 'Write an apology email for a delayed shipment',
    prompt: 'Draft a polite and professional email apologizing to a customer for a shipment delay. Offer a 10% discount on their next order.'
  },
  {
    icon: Code,
    title: 'Write code',
    desc: 'Create a TS debounce function',
    prompt: 'Write a robust, generic TypeScript debounce utility function with clear explanations of how it works.'
  }
];

export default function ChatWindow({ chatId, chatTitle, initialMessages, onMenuToggle, initialPrompt }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasTriggeredPrompt = useRef(false);

  // Sync state if chatId changes
  useEffect(() => {
    setMessages(initialMessages);
    setError(null);
    setIsLoading(false);
    hasTriggeredPrompt.current = false;
  }, [chatId, initialMessages]);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Handle initialPrompt trigger on mount/redirect
  useEffect(() => {
    if (initialPrompt && !hasTriggeredPrompt.current) {
      hasTriggeredPrompt.current = true;
      handleSendMessage(initialPrompt);

      // Clean up prompt parameter from URL
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('prompt');
        window.history.replaceState({}, '', url.pathname);
      }
    }
  }, [initialPrompt]);

  const handleSendMessage = async (text: string) => {
    if (isLoading) return;
    setError(null);

    // Create immediate local user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chatId,
          prompt: text
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      // Add AI reply to message state
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.content,
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to connect to the assistant');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col h-full bg-[#0a0a0a] text-neutral-100 overflow-hidden relative">
      
      {/* Top Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-900 bg-neutral-950/80 px-4 md:px-6 backdrop-blur-md z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuToggle}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-900 hover:text-white md:hidden cursor-pointer"
            title="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex flex-col min-w-0">
            <h2 className="text-sm font-semibold text-neutral-200 truncate pr-4">
              {chatTitle}
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Gemini 2.5 Flash</span>
            </div>
          </div>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-neutral-900/10">
        {messages.length === 0 ? (
          /* Empty Chat Welcome State */
          <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 text-center max-w-2xl mx-auto">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg mb-6 ring-4 ring-indigo-950/50">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent mb-2">
              How can I help you today?
            </h1>
            <p className="text-xs text-neutral-400 max-w-md mb-8">
              Ask anything. I can write code, draft essays, translate text, brainstorm ideas, or just chat with you.
            </p>

            {/* Suggestions cards */}
            <div className="grid grid-cols-1 gap-3 w-full sm:grid-cols-3">
              {SUGGESTIONS.map((item, idx) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(item.prompt)}
                    className="flex flex-col items-start rounded-2xl border border-neutral-800 bg-neutral-900/30 hover:bg-neutral-900/70 p-4 text-left transition-all duration-300 hover:border-neutral-700/60 shadow-sm cursor-pointer hover:translate-y-[-2px]"
                  >
                    <div className="p-2 rounded-lg bg-neutral-800 text-indigo-400 mb-3 border border-neutral-700/50">
                      <IconComp className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-neutral-200 mb-1">{item.title}</span>
                    <span className="text-[10px] text-neutral-500 leading-normal line-clamp-2">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Render message history list */
          <div className="flex flex-col py-2">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                createdAt={msg.created_at}
              />
            ))}

            {/* Loading/generating indicator */}
            {isLoading && (
              <div className="flex w-full gap-4 py-5 px-4 md:px-6 bg-neutral-900/35 border-y border-neutral-900/50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md animate-pulse">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex flex-col w-[75%] items-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-neutral-900 border border-neutral-850 px-4 py-3.5 shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span className="text-xs text-neutral-400 font-medium">Gemini is thinking...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="m-4 flex items-center gap-3 rounded-2xl border border-red-950/40 bg-red-950/15 p-4 text-xs text-red-400">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <div className="flex-1 font-medium">{error}</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input container */}
      <footer className="shrink-0 p-4 md:p-6 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent">
        <div className="max-w-3xl mx-auto">
          <PromptInput onSend={handleSendMessage} disabled={isLoading} />
          <div className="mt-2 text-center text-[10px] text-neutral-600">
            Gemini can make mistakes. Consider checking important information.
          </div>
        </div>
      </footer>

    </div>
  );
}
