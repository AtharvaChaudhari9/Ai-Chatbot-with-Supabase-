'use client';

import React, { useState, useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import PromptInput from './PromptInput';
import { Menu, Sparkles, Loader2, Compass, PenTool, Code, AlertCircle, FileText, Trash2, Activity, Bot, Lock, X, Settings } from 'lucide-react';
import { useModel, useAgent } from '@/app/chat/LayoutClient';
import ModelSelector from './ModelSelector';
import OcrBenchmarkModal from './OcrBenchmarkModal';
import { createClient } from '@/lib/supabase/client';

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

interface DocumentMeta {
  id: string;
  name: string;
  mime_type: string;
  storage_path: string;
  created_at: string;
  isAgentDoc?: boolean;
}

export default function ChatWindow({ chatId, chatTitle, initialMessages, onMenuToggle, initialPrompt }: ChatWindowProps) {
  const { model, localUrl, localModel } = useModel();
  const { openAgentModal } = useAgent();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Agent State
  const [agentDetails, setAgentDetails] = useState<any | null>(null);
  const [shuffledStarters, setShuffledStarters] = useState<string[]>([]);

  // RAG document state
  const [activeDocuments, setActiveDocuments] = useState<DocumentMeta[]>([]);
  const [isDocsLoading, setIsDocsLoading] = useState(false);
  const [benchmarkDoc, setBenchmarkDoc] = useState<DocumentMeta | null>(null);
  const [isKbModalOpen, setIsKbModalOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasTriggeredPrompt = useRef(false);

  const fetchDocuments = async () => {
    if (!chatId) return;
    setIsDocsLoading(true);
    try {
      // 1. Fetch chat documents
      const response = await fetch(`/api/documents/list?chatId=${chatId}`);
      let docs: DocumentMeta[] = [];
      if (response.ok) {
        const data = await response.json();
        docs = data.documents || [];
      }

      // 2. Fetch agent documents if applicable
      const supabase = createClient();
      const { data: chatData } = await supabase
        .from('chats')
        .select('agent_id')
        .eq('id', chatId)
        .single();

      if (chatData?.agent_id) {
        const agentDocRes = await fetch(`/api/documents/list?agentId=${chatData.agent_id}`);
        if (agentDocRes.ok) {
          const data = await agentDocRes.json();
          const agentDocs = (data.documents || []).map((d: any) => ({
            ...d,
            isAgentDoc: true
          }));
          docs = [...docs, ...agentDocs];
        }
      }

      setActiveDocuments(docs);
    } catch (err) {
      console.error('Failed to load active documents list:', err);
    } finally {
      setIsDocsLoading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      const response = await fetch('/api/documents/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId: docId }),
      });
      if (response.ok) {
        fetchDocuments();
      } else {
        const data = await response.json();
        alert(`Failed to delete document: ${data.error}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error deleting document: ${err.message}`);
    }
  };

  const fetchChatAgentDetails = async () => {
    if (!chatId) return;
    try {
      const supabase = createClient();
      const { data: chatData } = await supabase
        .from('chats')
        .select('agent_id')
        .eq('id', chatId)
        .single();
      
      if (chatData?.agent_id) {
        const { data: agent } = await supabase
          .from('custom_agents')
          .select('*')
          .eq('id', chatData.agent_id)
          .single();
        
        if (agent) {
          setAgentDetails(agent);
          const startersList = agent.conversation_starters || [];
          if (startersList.length > 0) {
            const shuffled = [...startersList].sort(() => 0.5 - Math.random());
            setShuffledStarters(shuffled.slice(0, 3));
          } else {
            setShuffledStarters([]);
          }
        } else {
          setAgentDetails(null);
          setShuffledStarters([]);
        }
      } else {
        setAgentDetails(null);
        setShuffledStarters([]);
      }
    } catch (err) {
      console.error('Error fetching chat agent details:', err);
      setAgentDetails(null);
      setShuffledStarters([]);
    }
  };

  // Fetch Agent Details on Chat change
  useEffect(() => {
    fetchChatAgentDetails();
  }, [chatId]);

  // Listen for agent configuration / KB updates to refresh active view state
  useEffect(() => {
    const handleUpdate = () => {
      fetchChatAgentDetails();
      fetchDocuments();
    };

    window.addEventListener('agent-settings-updated', handleUpdate);
    return () => {
      window.removeEventListener('agent-settings-updated', handleUpdate);
    };
  }, [chatId]);

  // Sync state if chatId changes
  useEffect(() => {
    setMessages(initialMessages);
    setError(null);
    setIsLoading(false);
    hasTriggeredPrompt.current = false;

    // Fetch documents on chat change
    fetchDocuments();
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

  const handleSendMessage = async (text: string, file?: File) => {
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
          prompt: text,
          model,
          localUrl,
          localModel
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
            <h2 className="text-sm font-semibold text-neutral-200 truncate pr-4 flex items-center gap-1.5">
              {agentDetails && (
                <span className="h-6 w-6 rounded-lg bg-neutral-900 border border-neutral-850 flex items-center justify-center text-sm shadow-sm select-none shrink-0">
                  {agentDetails.avatar_url && agentDetails.avatar_url.length <= 8 && !agentDetails.avatar_url.includes('/') ? agentDetails.avatar_url : '🤖'}
                </span>
              )}
              <span>{chatTitle}</span>
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-medium">
              <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${agentDetails ? 'bg-indigo-550' : 'bg-emerald-500'}`} />
              <span>
                {agentDetails 
                  ? `Locked: ${agentDetails.preferred_model === 'local' ? `Local LLM (${agentDetails.local_model_name || 'llama3.2'})` : 'Gemini Cloud'}`
                  : (model === 'local' ? `Local LLM (${localModel})` : 'Gemini 2.5 Flash')
                }
              </span>
            </div>
          </div>
        </div>
        {agentDetails ? (
          <button
            onClick={() => openAgentModal(agentDetails.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-[10px] text-indigo-400 hover:text-indigo-350 font-bold uppercase tracking-wide mr-2 shadow-sm cursor-pointer transition-colors"
            title="Configure Agent Settings"
          >
            <Settings className="w-3.5 h-3.5 text-indigo-400" />
            <span>Configure Agent</span>
          </button>
        ) : (
          <ModelSelector />
        )}
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-neutral-900/10">
        {messages.length === 0 ? (
          /* Empty Chat Welcome State */
          <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 text-center max-w-2xl mx-auto animate-in fade-in duration-300">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg mb-6 ring-4 ring-indigo-950/50">
              {agentDetails ? (
                <span className="text-3xl select-none">{agentDetails.avatar_url && agentDetails.avatar_url.length <= 8 && !agentDetails.avatar_url.includes('/') ? agentDetails.avatar_url : '🤖'}</span>
              ) : (
                <Sparkles className="w-7 h-7 text-white" />
              )}
            </div>

            <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent mb-2">
              {agentDetails ? `Chat with ${agentDetails.name}` : 'How can I help you today?'}
            </h1>
            <p className="text-xs text-neutral-400 max-w-md mb-8 leading-relaxed">
              {agentDetails 
                ? agentDetails.description || 'Specialized AI Assistant custom configured with prompt instructions.' 
                : 'Ask anything. I can write code, draft essays, translate text, brainstorm ideas, or just chat with you.'
              }
            </p>

            {/* Suggestions cards */}
            <div className="grid grid-cols-1 gap-3 w-full sm:grid-cols-3">
              {(shuffledStarters.length > 0 ? shuffledStarters : SUGGESTIONS.map(s => s.prompt)).map((promptText, idx) => {
                const isCustomStarter = shuffledStarters.length > 0;
                const cardTitle = isCustomStarter ? 'Ask Agent' : SUGGESTIONS[idx].title;
                const cardDesc = isCustomStarter ? promptText : SUGGESTIONS[idx].desc;
                const IconComp = isCustomStarter ? Compass : SUGGESTIONS[idx].icon;
                
                return (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(promptText)}
                    className="flex flex-col items-start rounded-2xl border border-neutral-800 bg-neutral-900/30 hover:bg-neutral-900/70 p-4 text-left transition-all duration-300 hover:border-neutral-700/60 shadow-sm cursor-pointer hover:translate-y-[-2px]"
                  >
                    <div className="p-2 rounded-lg bg-neutral-800 text-indigo-400 mb-3 border border-neutral-700/50">
                      <IconComp className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-neutral-200 mb-1">{cardTitle}</span>
                    <span className="text-[10px] text-neutral-500 leading-normal line-clamp-2">{cardDesc}</span>
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
                  {agentDetails ? (
                    <span className="text-lg select-none">{agentDetails.avatar_url && agentDetails.avatar_url.length <= 8 && !agentDetails.avatar_url.includes('/') ? agentDetails.avatar_url : '🤖'}</span>
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                </div>
                <div className="flex flex-col w-[75%] items-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-neutral-900 border border-neutral-850 px-4 py-3.5 shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span className="text-xs text-neutral-400 font-medium">
                      {agentDetails 
                        ? `${agentDetails.name} is formulating response...`
                        : (model === 'local' ? `${localModel} is thinking...` : 'Gemini is thinking...')
                      }
                    </span>
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

          {/* Active vector documents library bar */}
          {activeDocuments.length > 0 && (
            <div className="mb-3 flex items-center px-1">
              <button
                type="button"
                onClick={() => setIsKbModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-xs text-indigo-400 font-semibold transition-all hover:border-neutral-700/85 shadow-sm cursor-pointer hover:scale-[1.01]"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Active Knowledge Base ({activeDocuments.length} {activeDocuments.length === 1 ? 'document' : 'documents'})</span>
              </button>
            </div>
          )}

          <PromptInput
            onSend={handleSendMessage}
            disabled={isLoading}
            chatId={chatId}
            onUploadSuccess={fetchDocuments}
          />
          <div className="mt-2 text-center text-[10px] text-neutral-600">
            {model === 'local' ? `${localModel} can make mistakes. Consider checking important information.` : 'Gemini can make mistakes. Consider checking important information.'}
          </div>
        </div>
      </footer>

      {/* OCR Benchmarking Modal Container */}
      {benchmarkDoc && (
        <OcrBenchmarkModal
          documentId={benchmarkDoc.id}
          storagePath={benchmarkDoc.storage_path}
          documentName={benchmarkDoc.name}
          chatId={chatId}
          onClose={() => setBenchmarkDoc(null)}
          onBenchmarkComplete={fetchDocuments}
        />
      )}

      {/* Active Knowledge Base Modal */}
      {isKbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md px-4 py-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-neutral-900 bg-neutral-950 shadow-2xl p-6 flex flex-col max-h-[70vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-900 mb-4 select-none">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-neutral-100">Active Knowledge Base</h3>
                  <p className="text-[9px] text-neutral-500 font-medium leading-none mt-0.5">Documents providing context for the current conversation</p>
                </div>
              </div>
              <button
                onClick={() => setIsKbModalOpen(false)}
                className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-900 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List scroll container */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {activeDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-neutral-900/60 border border-neutral-850 text-xs text-neutral-350 hover:text-neutral-200 transition-all hover:bg-neutral-900"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 select-none">
                    <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="truncate font-semibold text-neutral-250" title={doc.name}>
                      {doc.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* OCR Benchmark Button */}
                    <button
                      onClick={() => {
                        setBenchmarkDoc(doc);
                        setIsKbModalOpen(false);
                      }}
                      className="p-1 rounded-lg text-neutral-500 hover:text-indigo-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                      title="Benchmark OCR / Extraction Engines"
                    >
                      <Activity className="w-3.5 h-3.5" />
                    </button>

                    {doc.isAgentDoc ? (
                      <span className="text-[8px] text-indigo-400 bg-indigo-950 border border-indigo-900/50 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider select-none shrink-0">
                        Agent KB
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-1 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
                        title="Remove from knowledge base"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-5 pt-3 border-t border-neutral-900 flex justify-end">
              <button
                type="button"
                onClick={() => setIsKbModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
