'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSidebar } from './LayoutClient';
import PromptInput from '@/components/PromptInput';
import ModelSelector from '@/components/ModelSelector';
import { Sparkles, Compass, PenTool, Code, Menu, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

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


export default function ChatLandingPage() {
  const router = useRouter();
  const { toggle } = useSidebar();
  const [isPending, startTransition] = useTransition();

  const handleStartConversation = (text: string, file?: File) => {
    startTransition(async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Create the new chat in database with a placeholder title
        const { data: chat, error } = await supabase
          .from('chats')
          .insert({
            user_id: user.id,
            title: 'New Chat',
          })
          .select('id')
          .single();

        if (error || !chat) {
          throw new Error(error?.message || 'Failed to create chat');
        }

        // Upload the file if provided
        if (file) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('chatId', chat.id);
          const response = await fetch('/api/documents/upload', {
            method: 'POST',
            body: formData,
          });
          if (!response.ok) {
            console.error('Failed to upload landing page document');
          }
        }

        // Redirect to the chat page with the prompt query parameter
        router.push(`/chat/${chat.id}?prompt=${encodeURIComponent(text)}`);
        router.refresh();
      } catch (err) {
        console.error('Error starting conversation:', err);
      }
    });
  };

  return (
    <div className="flex flex-1 flex-col h-full bg-[#0a0a0a] text-neutral-100 overflow-hidden relative">

      <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-900 bg-neutral-950/80 px-4 md:px-6 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-900 hover:text-white md:hidden cursor-pointer"
            title="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-neutral-200">
              New Chat
            </h2>
          </div>
        </div>
        <ModelSelector />
      </header>

      {/* Main dashboard content */}
      <div className="flex-1 overflow-y-auto flex flex-col justify-center items-center px-4 max-w-2xl mx-auto w-full">
        {isPending ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
            <p className="text-sm text-neutral-400 font-medium">Creating your conversation room...</p>
          </div>
        ) : (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg mb-6 ring-4 ring-indigo-950/50">
              <Sparkles className="w-7 h-7 text-white" />
            </div>

            <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent mb-2 text-center">
              How can I help you today?
            </h1>
            <p className="text-xs text-neutral-400 max-w-md mb-8 text-center">
              Ask anything. I can write code, draft essays, translate text, brainstorm ideas, or just chat with you.
            </p>

            {/* Suggestions cards */}
            <div className="grid grid-cols-1 gap-3 w-full sm:grid-cols-3 mb-6">
              {SUGGESTIONS.map((item, idx) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleStartConversation(item.prompt)}
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
          </>
        )}
      </div>

      {/* Input container */}
      <footer className="shrink-0 p-4 md:p-6 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/90 to-transparent">
        <div className="max-w-3xl mx-auto">
          <PromptInput onSend={handleStartConversation} disabled={isPending} />
          <div className="mt-2 text-center text-[10px] text-neutral-600">
            Gemini can make mistakes. Consider checking important information.
          </div>
        </div>
      </footer>

    </div>
  );
}
