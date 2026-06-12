'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Plus, Search, MessageSquare, Trash2, Edit2, 
  Check, X, LogOut, Loader2, Sparkles, FolderOpen 
} from 'lucide-react';
import { createChat, renameChat, deleteChat } from '@/app/chat/actions';
import { createClient } from '@/lib/supabase/client';

interface ChatItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const handleNewChat = () => {
    startTransition(async () => {
      try {
        await createChat();
      } catch (err) {
        console.error('Failed to create chat:', err);
      }
    });
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

  // Filter chats by search query
  const filteredChats = chats.filter(chat => 
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <div className="p-3.5">
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

        {/* Search Input bar */}
        <div className="px-3.5 pb-2">
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
          {filteredChats.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-600 italic">
              {searchQuery ? 'No chats match search' : 'No chats yet'}
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isActive = chat.id === currentChatId;
              const isEditing = editingId === chat.id;

              return (
                <div
                  key={chat.id}
                  className={`group relative flex items-center rounded-xl text-xs transition-all ${
                    isActive 
                      ? 'bg-neutral-900 text-white font-medium border border-neutral-800/80 shadow-sm' 
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
                        className="flex flex-1 items-center gap-2 px-3 py-3 overflow-hidden select-none"
                      >
                        <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
                        <span className="truncate pr-16">{chat.title}</span>
                      </Link>

                      {/* Hover Actions: Rename, Delete */}
                      <div className="absolute right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => handleStartRename(e, chat.id, chat.title)}
                          className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 cursor-pointer"
                          title="Rename Chat"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === chat.id}
                          onClick={(e) => handleDelete(e, chat.id)}
                          className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-red-400 cursor-pointer"
                          title="Delete Chat"
                        >
                          {deletingId === chat.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
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
