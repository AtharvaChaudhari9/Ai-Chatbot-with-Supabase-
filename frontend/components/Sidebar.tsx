'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Plus, Search, MessageSquare, Trash2, Edit2, 
  Check, X, LogOut, Loader2, Sparkles, FolderOpen,
  Bot, Settings, ChevronDown, ChevronRight
} from 'lucide-react';
import { createChat, renameChat, deleteChat } from '@/app/chat/actions';
import { createClient } from '@/lib/supabase/client';
import { useAgent } from '@/app/chat/LayoutClient';

interface ChatItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  agent_id?: string | null;
}

interface SidebarProps {
  chats: ChatItem[];
  currentChatId?: string;
  userEmail?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ chats, currentChatId, userEmail, isOpen, onClose }: SidebarProps) {
  const router = useRouter();
  const { agents, refreshAgents, openAgentModal } = useAgent();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [isStartingAgent, setIsStartingAgent] = useState<string | null>(null);
  
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({});

  // Auto-expand agent if one of its chats is active
  React.useEffect(() => {
    if (currentChatId && chats) {
      const activeChat = chats.find(c => c.id === currentChatId);
      if (activeChat && activeChat.agent_id) {
        setExpandedAgents(prev => ({
          ...prev,
          [activeChat.agent_id!]: true
        }));
      }
    }
  }, [currentChatId, chats]);

  // Auto-expand agents matching search query
  React.useEffect(() => {
    if (searchQuery && chats) {
      const matchingAgentIds = chats
        .filter(c => c.agent_id && c.title.toLowerCase().includes(searchQuery.toLowerCase()))
        .map(c => c.agent_id!);
      if (matchingAgentIds.length > 0) {
        setExpandedAgents(prev => {
          const next = { ...prev };
          matchingAgentIds.forEach(id => {
            next[id] = true;
          });
          return next;
        });
      }
    }
  }, [searchQuery, chats]);

  const toggleAgentExpand = (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setExpandedAgents(prev => ({
      ...prev,
      [agentId]: !prev[agentId]
    }));
  };

  const handleNewChat = () => {
    startTransition(async () => {
      try {
        await createChat();
      } catch (err) {
        console.error('Failed to create chat:', err);
      }
    });
  };

  const handleStartAgentChat = (agentId: string) => {
    setIsStartingAgent(agentId);
    startTransition(async () => {
      try {
        await createChat(agentId);
      } catch (err) {
        console.error('Failed to start agent chat:', err);
      } finally {
        setIsStartingAgent(null);
      }
    });
  };

  const handleAgentClick = (agentId: string) => {
    // Find existing chats for this agent (first one is the most recent because chats are sorted by updated_at descending in layout.tsx)
    const agentChats = chats.filter(c => c.agent_id === agentId);
    if (agentChats.length > 0) {
      router.push(`/chat/${agentChats[0].id}`);
      onClose();
    } else {
      handleStartAgentChat(agentId);
    }
  };

  const handleDeleteAgent = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm('Are you sure you want to delete this specialized assistant and all its knowledge files?')) return;
    try {
      const response = await fetch(`/api/agents/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        refreshAgents();
      } else {
        alert('Failed to delete assistant.');
      }
    } catch (err) {
      console.error('Failed to delete assistant:', err);
    }
  };

  const handleStartRename = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingId(id);
    setEditTitle(title);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingId(null);
    setEditTitle('');
  };

  const handleSaveRename = async (e: React.FormEvent | React.MouseEvent, id: string) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!editTitle.trim()) return;

    setRenamingId(id);
    try {
      await renameChat(id, editTitle.trim());
      setEditingId(null);
    } catch (err) {
      console.error('Failed to rename chat:', err);
    } finally {
      setRenamingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    setDeletingId(id);
    try {
      await deleteChat(id);
      if (currentChatId === id) {
        router.push('/chat');
      }
    } catch (err) {
      console.error('Failed to delete chat:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const renderChatItem = (chat: ChatItem) => {
    const isActive = chat.id === currentChatId;
    const isEditing = editingId === chat.id;

    return (
      <div
        key={chat.id}
        className={`group relative flex items-center rounded-xl text-xs transition-all ${
          isActive 
            ? 'bg-neutral-905 bg-neutral-900 text-white font-medium border border-neutral-800/80 shadow-sm' 
            : 'hover:bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 border border-transparent'
        }`}
      >
        {isEditing ? (
          <form 
            onSubmit={(e) => handleSaveRename(e, chat.id)}
            className="flex w-full items-center gap-1.5 px-3 py-2"
          >
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex-1 bg-transparent border-b border-indigo-500 text-neutral-200 focus:outline-none text-xs"
              autoFocus
            />
            <button 
              type="submit" 
              disabled={renamingId === chat.id}
              className="text-emerald-400 hover:text-emerald-300 p-0.5 cursor-pointer"
            >
              {renamingId === chat.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button 
              type="button" 
              onClick={handleCancelRename} 
              className="text-red-400 hover:text-red-300 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <>
            <Link
              href={`/chat/${chat.id}`}
              onClick={onClose}
              className="flex flex-1 items-center gap-2 px-3 py-2.5 overflow-hidden select-none"
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
              <span className="truncate pr-16 text-[11px]">{chat.title}</span>
            </Link>

            {/* Hover Actions: Rename, Delete */}
            <div className="absolute right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => handleStartRename(e, chat.id, chat.title)}
                className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 cursor-pointer"
                title="Rename Chat"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={deletingId === chat.id}
                onClick={(e) => handleDelete(e, chat.id)}
                className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-red-400 cursor-pointer"
                title="Delete Chat"
              >
                {deletingId === chat.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  // Filter chats by search query
  const filteredChats = chats.filter(chat => 
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const regularChats = filteredChats.filter(chat => !chat.agent_id);

  return (
    <>
      {/* Mobile Overlay backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 md:hidden backdrop-blur-sm transition-opacity duration-300"
        />
      )}

      {/* Sidebar Drawer container */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-neutral-800 bg-neutral-950 text-neutral-200 transition-transform duration-300 md:static md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        
        {/* Header Title */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-neutral-900 bg-neutral-950">
          <Link href="/chat" className="flex items-center gap-2 cursor-pointer">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-md">
              <Sparkles className="w-4 h-4 text-white" />
            </span>
            <span className="font-bold text-md bg-gradient-to-r from-neutral-100 to-neutral-400 bg-clip-text text-transparent">
              Gemini Chatbot
            </span>
          </Link>
          <button 
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-900 hover:text-white md:hidden cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Button: New Chat */}
        <div className="p-3.5 pb-2">
          <button
            onClick={handleNewChat}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black px-4 py-3 text-sm font-semibold shadow-sm transition-all duration-200 disabled:opacity-55 cursor-pointer"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-black" />
            ) : (
              <Plus className="h-4 w-4 text-black" />
            )}
            New Chat
          </button>
        </div>

        {/* Specialized Agents list */}
        <div className="px-3.5 pb-3.5 border-b border-neutral-900/60 flex flex-col min-h-0">
          <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-neutral-500 uppercase mb-2 select-none">
            <span className="flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
              Specialized Agents
            </span>
            <button
              onClick={() => openAgentModal(null)}
              className="p-1 rounded text-neutral-500 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
              title="Create New Agent"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 select-none scrollbar-thin">
            {agents.map((agent) => {
              const hasChats = chats.some(c => c.agent_id === agent.id);
              const isExpanded = !!expandedAgents[agent.id];
              const agentChats = filteredChats.filter(chat => chat.agent_id === agent.id);

              return (
                <div key={agent.id} className="flex flex-col">
                  <div
                    className="group relative flex items-center rounded-xl text-xs hover:bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 border border-transparent transition-all"
                  >
                    {/* Expand/Collapse Chevron or alignment spacer */}
                    {hasChats ? (
                      <button
                        onClick={(e) => toggleAgentExpand(agent.id, e)}
                        className="p-1 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors ml-1 cursor-pointer shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    ) : (
                      <div className="w-5.5 ml-1 shrink-0" />
                    )}

                    <button
                      onClick={() => handleAgentClick(agent.id)}
                      disabled={isStartingAgent !== null}
                      className="flex flex-1 items-center gap-2 px-2 py-2 overflow-hidden text-left cursor-pointer"
                    >
                      <span className="h-6 w-6 rounded-lg bg-neutral-900 border border-neutral-850 flex items-center justify-center text-sm shadow-sm shrink-0">
                        {agent.avatar_url && agent.avatar_url.length <= 8 && !agent.avatar_url.includes('/') ? agent.avatar_url : '🤖'}
                      </span>
                      <span className="truncate pr-10 font-semibold">{agent.name}</span>
                    </button>

                    {/* Hover Actions: New Chat, Edit, Delete */}
                    <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleStartAgentChat(agent.id)}
                        className="rounded p-0.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 cursor-pointer"
                        title="New Chat with Agent"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openAgentModal(agent.id)}
                        className="rounded p-0.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 cursor-pointer"
                        title="Edit Agent"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteAgent(e, agent.id)}
                        className="rounded p-0.5 text-neutral-500 hover:bg-neutral-800 hover:text-red-400 cursor-pointer"
                        title="Delete Agent"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Indented nested chats */}
                  {isExpanded && agentChats.length > 0 && (
                    <div className="pl-4 mt-0.5 mb-1.5 space-y-0.5 border-l border-neutral-800 ml-[18px]">
                      {agentChats.map(renderChatItem)}
                    </div>
                  )}
                </div>
              );
            })}
            {agents.length === 0 && (
              <div className="text-[10px] text-neutral-600 italic py-1.5 px-2.5 select-none">
                No custom agents yet.
              </div>
            )}
          </div>
        </div>

        {/* Search Input bar */}
        <div className="px-3.5 py-2">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search conversations"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-neutral-900 bg-neutral-900/40 pl-10 pr-4 py-2.5 text-xs text-neutral-200 placeholder-neutral-500 focus:border-neutral-800 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Recent Chats list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 scrollbar-thin">
          <div className="px-3 mb-2 text-[10px] font-bold tracking-wider text-neutral-500 uppercase flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5" />
            Recent Chats
          </div>
          {regularChats.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-600 italic select-none">
              {searchQuery ? 'No chats match search' : 'No chats yet'}
            </div>
          ) : (
            regularChats.map(renderChatItem)
          )}
        </div>

        {/* Footer Profile summary & Logout */}
        <div className="mt-auto border-t border-neutral-900 bg-neutral-950 p-4 flex flex-col gap-2">
          {userEmail && (
            <div className="flex items-center gap-2 px-1 py-1">
              <div className="h-7 w-7 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-xs text-neutral-300 border border-neutral-700 uppercase">
                {userEmail.substring(0, 2)}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-neutral-300 truncate">
                  User Account
                </span>
                <span className="text-[10px] text-neutral-500 truncate leading-none">
                  {userEmail}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-between gap-2 rounded-xl bg-neutral-900 hover:bg-neutral-900/60 border border-neutral-800/80 px-3.5 py-2.5 text-xs text-red-400 hover:text-red-300 transition-colors font-medium cursor-pointer"
          >
            <span>Sign Out</span>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
