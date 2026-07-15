'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Plus, Search, MessageSquare, Trash2, Edit2, 
  Check, X, LogOut, Loader2, Sparkles, FolderOpen,
  Bot, Settings, ChevronDown, ChevronRight
} from 'lucide-react';
import { createChat, renameChat, deleteChat } from '@/app/chat/actions';
import { useAgent } from '@/app/chat/LayoutClient';
import { useSession, signOut } from 'next-auth/react';


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
  const { data: session } = useSession();
  const { agents, refreshAgents, openAgentModal } = useAgent();

  const [nickname, setNickname] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // In-app 2FA Setup states
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [tempSecret, setTempSecret] = useState<string | null>(null);
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [mfaSetupError, setMfaSetupError] = useState('');
  const [isGeneratingMfa, setIsGeneratingMfa] = useState(false);
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [isDisablingMfa, setIsDisablingMfa] = useState(false);
  const [mfaSetupSuccess, setMfaSetupSuccess] = useState(false);
  const [isTriggeringPasswordChange, setIsTriggeringPasswordChange] = useState(false);
  const [isPasswordConfirmOpen, setIsPasswordConfirmOpen] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/user/profile');
        if (res.ok) {
          const data = await res.json();
          setNickname(data.nickname);
          setAvatarUrl(data.avatarUrl);
          setMfaEnabled(data.mfaEnabled || false);
          setEditNickname(data.nickname || '');
          setEditAvatarUrl(data.avatarUrl || '');
        }
      } catch (e) {
        console.error('Failed to load profile details:', e);
      }
    };
    if (session?.user) {
      fetchProfile();
    }
  }, [session]);

  const getKeycloakBaseUrl = () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:8080' : window.location.origin;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 250 * 1024) {
        alert('Profile image size must be less than 250KB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setEditAvatarUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: editNickname.trim() || null,
          avatarUrl: editAvatarUrl.trim() || null,
        }),
      });
      if (res.ok) {
        setNickname(editNickname.trim() || null);
        setAvatarUrl(editAvatarUrl.trim() || null);
        setIsSettingsOpen(false);
      } else {
        alert('Failed to update profile settings.');
      }
    } catch (e) {
      console.error(e);
      alert('An error occurred while saving profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleStartMfaSetup = async () => {
    setIsGeneratingMfa(true);
    setMfaSetupError('');
    setMfaSetupSuccess(false);
    try {
      const res = await fetch('/api/user/mfa/generate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setQrCodeUrl(data.qrUrl);
        setTempSecret(data.secret);
      } else {
        setMfaSetupError('Failed to generate MFA setup details.');
      }
    } catch (e) {
      console.error(e);
      setMfaSetupError('An error occurred during MFA generation.');
    } finally {
      setIsGeneratingMfa(false);
    }
  };

  const handleVerifyAndEnableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCodeInput.length !== 6) {
      setMfaSetupError('Please enter a 6-digit code.');
      return;
    }
    setMfaSetupError('');
    setIsVerifyingMfa(true);
    try {
      const res = await fetch('/api/user/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpCodeInput, secret: tempSecret }),
      });
      if (res.ok) {
        setMfaEnabled(true);
        setMfaSetupSuccess(true);
        // Clear setup templates
        setQrCodeUrl(null);
        setTempSecret(null);
        setOtpCodeInput('');
      } else {
        const data = await res.json();
        setMfaSetupError(data.error || 'Invalid code. Please try again.');
      }
    } catch (e) {
      console.error(e);
      setMfaSetupError('An error occurred while verifying 2FA.');
    } finally {
      setIsVerifyingMfa(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!confirm('Are you sure you want to disable 2-Factor Authentication? Your account will be less secure.')) {
      return;
    }
    setIsDisablingMfa(true);
    try {
      const res = await fetch('/api/user/mfa/disable', { method: 'POST' });
      if (res.ok) {
        setMfaEnabled(false);
        setMfaSetupSuccess(false);
        alert('2-Factor Authentication has been disabled.');
      } else {
        alert('Failed to disable 2-Factor Authentication.');
      }
    } catch (e) {
      console.error(e);
      alert('An error occurred while disabling 2FA.');
    } finally {
      setIsDisablingMfa(false);
    }
  };

  const handleTriggerPasswordChange = async () => {
    setIsTriggeringPasswordChange(true);
    try {
      const res = await fetch('/api/user/change-password', { method: 'POST' });
      if (res.ok) {
        setIsPasswordConfirmOpen(false);
        setIsSettingsOpen(false);
        await handleLogout();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to trigger password change.');
      }
    } catch (e) {
      console.error(e);
      alert('An error occurred while triggering password change.');
    } finally {
      setIsTriggeringPasswordChange(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [isStartingAgent, setIsStartingAgent] = useState<string | null>(null);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  
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
    setChatToDelete(id);
  };

  const handleLogout = async () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const keycloakBaseUrl = isLocal 
      ? 'http://localhost:8080' 
      : window.location.origin;
    const postLogoutRedirectUri = window.location.origin + '/login';
    
    let keycloakLogoutUrl = `${keycloakBaseUrl}/realms/chatbot-realm/protocol/openid-connect/logout?client_id=chatbot-frontend&post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirectUri)}`;
    
    if (session?.idToken) {
      keycloakLogoutUrl += `&id_token_hint=${session.idToken}`;
    }
    
    await signOut({
      callbackUrl: keycloakLogoutUrl,
    });
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
              Cognexa
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
            <div className="flex items-center justify-between gap-2 px-1 py-1">
              <div className="flex items-center gap-2 min-w-0">
                {/* Profile Picture */}
                {avatarUrl || session?.user?.image ? (
                  <img 
                    src={avatarUrl || session?.user?.image || ''} 
                    alt="Profile" 
                    className="h-8 w-8 rounded-full border border-neutral-800/80 object-cover shrink-0 select-none ring-2 ring-indigo-500/10 hover:ring-indigo-500/35 transition-all"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-neutral-850 flex items-center justify-center font-bold text-xs text-indigo-400 border border-neutral-800 uppercase shrink-0 select-none">
                    {(nickname || session?.user?.name || userEmail).substring(0, 2)}
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-bold text-neutral-200 truncate select-none leading-tight">
                    {nickname || session?.user?.name || 'User Account'}
                  </span>
                  <span className="text-[9px] text-neutral-550 truncate leading-none">
                    {userEmail}
                  </span>
                </div>
              </div>

              {/* Settings Gear Icon */}
              <button
                type="button"
                onClick={() => {
                  setEditNickname(nickname || session?.user?.name || '');
                  setEditAvatarUrl(avatarUrl || session?.user?.image || '');
                  setMfaSetupError('');
                  setMfaSetupSuccess(false);
                  setQrCodeUrl(null);
                  setTempSecret(null);
                  setOtpCodeInput('');
                  setIsSettingsOpen(true);
                }}
                className="p-1.5 rounded-lg text-neutral-550 hover:bg-neutral-900 hover:text-white cursor-pointer transition-colors shrink-0"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
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

      {/* Premium Confirm Delete Modal */}
      {chatToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-80 rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl transition-all">
            <h3 className="text-base font-semibold text-white">Delete Chat?</h3>
            <p className="mt-2 text-xs text-neutral-400">
              Are you sure you want to delete this conversation? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setChatToDelete(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-400 hover:bg-neutral-900 hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const id = chatToDelete;
                  setChatToDelete(null);
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
                }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 transition-all cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-[420px] rounded-3xl border border-neutral-900 bg-neutral-950 p-6 shadow-2xl transition-all">
            <div className="flex items-center justify-between mb-5 border-b border-neutral-905 bg-neutral-950 border-neutral-900 pb-3">
              <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider select-none">User Settings</h3>
              <button 
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-lg text-neutral-500 hover:bg-neutral-900 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Profile Pic Upload Section */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  {editAvatarUrl ? (
                    <img 
                      src={editAvatarUrl} 
                      alt="Avatar Preview" 
                      className="h-16 w-16 rounded-full border-2 border-indigo-500/55 object-cover shadow-lg shadow-indigo-500/5 select-none"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-neutral-850 border border-neutral-800 flex items-center justify-center font-bold text-xl text-neutral-400 select-none">
                      {(editNickname || session?.user?.name || userEmail || 'US').substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  
                  {/* File Upload Input */}
                  <label className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-[10px] text-neutral-200 font-bold select-none">
                    Change
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange}
                      className="hidden" 
                    />
                  </label>
                </div>
                <span className="text-[10px] text-neutral-500 font-medium">Click image to upload custom photo (Max 250KB)</span>
              </div>

              {/* Nickname Input field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider select-none">Nickname</label>
                <input
                  type="text"
                  maxLength={35}
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  placeholder="Enter display nickname"
                  className="w-full rounded-xl border border-neutral-900 bg-neutral-900/40 px-3.5 py-2.5 text-xs text-neutral-250 placeholder-neutral-550 focus:border-neutral-800 focus:outline-none transition-colors"
                />
              </div>

              {/* User Metadata Display */}
              <div className="space-y-1 bg-neutral-900/10 border border-neutral-900 p-3.5 rounded-2xl text-[10px] text-neutral-500 select-none">
                <div className="flex justify-between">
                  <span className="font-semibold">Email:</span>
                  <span className="text-neutral-400 truncate max-w-[200px]" title={userEmail}>{userEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">ID:</span>
                  <span className="text-neutral-400 font-mono text-[9px] truncate max-w-[200px]" title={session?.user?.id}>{session?.user?.id}</span>
                </div>
              </div>

              {/* Keycloak Security Redirection & Dynamic 2FA Setup */}
              <div className="border-t border-neutral-900 pt-4 space-y-3">
                <div className="space-y-1 select-none">
                  <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Account Credentials & Security</h4>
                  <p className="text-[9px] text-neutral-550 leading-relaxed font-semibold">
                    Change your password directly on Keycloak, or manage secure 2-Factor Authentication (OTP) using Authenticator Apps.
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPasswordConfirmOpen(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-[10px] text-neutral-350 hover:text-white px-3.5 py-2.5 transition-colors font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Change Password
                  </button>
                  
                  {mfaEnabled ? (
                    <button
                      type="button"
                      onClick={handleDisableMfa}
                      disabled={isDisablingMfa}
                      className="flex-1 rounded-xl bg-red-950/20 hover:bg-red-900 border border-red-900/30 text-[10px] text-red-400 hover:text-white px-3.5 py-2.5 transition-colors font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50"
                    >
                      {isDisablingMfa ? 'Disabling...' : 'Disable 2FA 🔒'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartMfaSetup}
                      disabled={isGeneratingMfa || qrCodeUrl !== null}
                      className="flex-1 rounded-xl bg-indigo-650/45 hover:bg-indigo-600 border border-indigo-500/20 text-[10px] text-indigo-400 hover:text-white px-3.5 py-2.5 transition-colors font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50"
                    >
                      {isGeneratingMfa ? 'Generating...' : 'Set Up 2FA'}
                    </button>
                  )}
                </div>

                {mfaSetupSuccess && (
                  <div className="bg-emerald-950/15 border border-emerald-950/40 text-emerald-400 p-3 rounded-xl text-[10px] font-semibold leading-relaxed animate-in fade-in duration-200 animate-pulse">
                    🎉 2-Factor Authentication has been successfully enabled! Your account is now fully secured.
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 border-t border-neutral-900 pt-4">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-neutral-400 hover:bg-neutral-900 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2FA Setup Modal */}
      {qrCodeUrl && tempSecret && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-[380px] rounded-3xl border border-neutral-900 bg-neutral-950 p-6 shadow-2xl transition-all">
            <div className="flex items-center justify-between mb-5 border-b border-neutral-905 bg-neutral-950 border-neutral-900 pb-3">
              <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider select-none">Set Up 2FA</h3>
              <button 
                type="button"
                onClick={() => {
                  setQrCodeUrl(null);
                  setTempSecret(null);
                  setOtpCodeInput('');
                  setMfaSetupError('');
                }}
                className="p-1 rounded-lg text-neutral-500 hover:bg-neutral-900 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="flex flex-col items-center gap-3">
                <span className="text-[10px] text-neutral-500 font-medium text-center leading-relaxed">Scan this QR Code with your Google Authenticator app:</span>
                <img 
                  src={qrCodeUrl} 
                  alt="TOTP QR Code" 
                  className="h-36 w-36 rounded-xl border border-neutral-800 bg-white p-2.5 shadow-lg select-none"
                />
                <div className="text-center space-y-1">
                  <span className="text-[9px] text-neutral-550 leading-none block">Manual Secret Key:</span>
                  <code className="text-[10px] text-indigo-400 font-mono font-bold tracking-wider select-all">{tempSecret}</code>
                </div>
              </div>

              <form onSubmit={handleVerifyAndEnableMfa} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Enter 6-Digit Authenticator Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      pattern="[0-9]*"
                      inputMode="numeric"
                      placeholder="000000"
                      value={otpCodeInput}
                      onChange={(e) => setOtpCodeInput(e.target.value.replace(/[^0-9]/g, ''))}
                      className="flex-1 text-center font-bold tracking-[0.25em] text-xs rounded-xl border border-neutral-900 bg-neutral-950 px-3 py-2 text-neutral-250 focus:border-neutral-800 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={isVerifyingMfa}
                      className="rounded-xl bg-indigo-650 hover:bg-indigo-600 text-[10px] text-white px-4 font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50 animate-pulse"
                    >
                      {isVerifyingMfa ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                </div>

                {mfaSetupError && (
                  <div className="text-[9px] text-red-400 font-semibold bg-red-950/15 border border-red-950/40 rounded-lg p-2 leading-relaxed animate-in fade-in duration-200">
                    {mfaSetupError}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Confirmation Modal */}
      {isPasswordConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-[360px] rounded-3xl border border-neutral-900 bg-neutral-950 p-6 shadow-2xl transition-all">
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-2xl bg-indigo-650/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="w-5 h-5 text-indigo-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider select-none">Change Password</h3>
              <p className="mt-2 text-[10px] text-neutral-500 leading-relaxed font-semibold">
                To securely update your credentials, you will be logged out and directed to Keycloak's secure password reset portal.
              </p>
            </div>
            
            <div className="mt-6 flex justify-end gap-3 border-t border-neutral-900 pt-4">
              <button
                type="button"
                onClick={() => setIsPasswordConfirmOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-neutral-400 hover:bg-neutral-900 hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isTriggeringPasswordChange}
                onClick={handleTriggerPasswordChange}
                className="rounded-xl bg-indigo-650 hover:bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isTriggeringPasswordChange ? 'Processing...' : 'Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
