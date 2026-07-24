'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Plus, Search, MessageSquare, Trash2, Edit2, 
  Check, X, LogOut, Loader2, Sparkles, FolderOpen,
  Bot, Settings, ChevronDown, ChevronRight, MoreVertical
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
  defaultName: string;
  defaultImage: string;
  initialNickname: string | null;
  initialAvatarUrl: string | null;
  initialMfaEnabled: boolean;
  onMfaEnabled?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ 
  chats, 
  currentChatId, 
  userEmail, 
  defaultName,
  defaultImage,
  initialNickname, 
  initialAvatarUrl, 
  initialMfaEnabled, 
  onMfaEnabled,
  isOpen, 
  onClose 
}: SidebarProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { agents, refreshAgents, openAgentModal } = useAgent();

  const [nickname, setNickname] = useState<string | null>(initialNickname);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [mfaEnabled, setMfaEnabled] = useState(initialMfaEnabled);
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
  const [isDisableMfaConfirmOpen, setIsDisableMfaConfirmOpen] = useState(false);
  const [isDisableMfaSuccessOpen, setIsDisableMfaSuccessOpen] = useState(false);
  const [mfaDisableError, setMfaDisableError] = useState('');

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
        if (onMfaEnabled) {
          onMfaEnabled();
        }
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
    setMfaDisableError('');
    setIsDisablingMfa(true);
    try {
      const res = await fetch('/api/user/mfa/disable', { method: 'POST' });
      if (res.ok) {
        setMfaEnabled(false);
        setMfaSetupSuccess(false);
        setIsDisableMfaConfirmOpen(false);
        setIsDisableMfaSuccessOpen(true);
      } else {
        const data = await res.json();
        setMfaDisableError(data.error || 'Failed to disable 2-Factor Authentication.');
      }
    } catch (e) {
      console.error(e);
      setMfaDisableError('An error occurred while disabling 2FA.');
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
    onClose();
    startTransition(async () => {
      try {
        await createChat();
      } catch (err) {
        console.error('Failed to create chat:', err);
      }
    });
  };

  const handleStartAgentChat = (agentId: string) => {
    onClose();
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
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('mfa_verified');
    }
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


  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [activeMenuChatId, setActiveMenuChatId] = useState<string | null>(null);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);

  const agentDropdownRef = React.useRef<HTMLDivElement>(null);
  const chatMenuRef = React.useRef<HTMLDivElement>(null);

  // Close popover menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(event.target as Node)) {
        setIsAgentDropdownOpen(false);
      }
      if (chatMenuRef.current && !chatMenuRef.current.contains(event.target as Node)) {
        setActiveMenuChatId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Automatically default to the most recent custom agent on new login / session
  useEffect(() => {
    if (currentChatId) {
      const currentChat = chats.find(c => c.id === currentChatId);
      if (currentChat && currentChat.agent_id) {
        setSelectedAgentId(currentChat.agent_id);
        return;
      }
    }
    if (!selectedAgentId && agents.length > 0) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, currentChatId]);

  const renderChatItem = (chat: ChatItem) => {
    const isActive = chat.id === currentChatId;
    const isEditing = editingId === chat.id;
    const isMenuOpen = activeMenuChatId === chat.id;

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
              className="flex flex-1 items-center gap-2 px-3 py-2.5 overflow-hidden select-none pr-9"
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
              <span className="truncate text-[11px]">{chat.title}</span>
            </Link>

            {/* 3-Dot Options Trigger */}
            <div className="absolute right-1.5 flex items-center">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveMenuChatId(isMenuOpen ? null : chat.id);
                }}
                className={`rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer ${
                  isMenuOpen ? 'bg-neutral-800 text-white opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
                }`}
                title="Chat Options"
                data-testid="chat-options-button"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {/* Overlaid Popover Dropdown for Chat CRUD Options */}
              {isMenuOpen && (
                <div 
                  ref={chatMenuRef}
                  className="absolute right-0 top-7 z-50 w-36 rounded-xl bg-neutral-900 border border-neutral-800 p-1 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-0.5"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuChatId(null);
                      handleStartRename(e, chat.id, chat.title);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors text-left cursor-pointer"
                    data-testid="rename-chat-button"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Rename</span>
                  </button>

                  <button
                    type="button"
                    disabled={deletingId === chat.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuChatId(null);
                      handleDelete(e, chat.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left cursor-pointer disabled:opacity-50"
                    data-testid="delete-chat-button"
                  >
                    {deletingId === chat.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>Delete</span>
                  </button>
                </div>
              )}
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

      {/* Sidebar Drawer container (Supports Collapsing on Both Windows & Android) */}
      <aside data-testid="sidebar" className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-neutral-800 bg-neutral-950 text-neutral-200 transition-all duration-300 md:static h-full overflow-hidden shrink-0 ${
        isOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full border-none pointer-events-none'
      }`}>
        
        {/* Top Header: Logged-in User Profile & Settings Trigger */}
        <div className="flex h-16 items-center justify-between px-3.5 border-b border-neutral-900 bg-neutral-950 shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditNickname(nickname || defaultName || '');
              setEditAvatarUrl(avatarUrl || defaultImage || '');
              setMfaSetupError('');
              setMfaSetupSuccess(false);
              setQrCodeUrl(null);
              setTempSecret(null);
              setOtpCodeInput('');
              setIsSettingsOpen(true);
            }}
            className="flex items-center gap-2.5 cursor-pointer group text-left min-w-0 flex-1 pr-2"
            title="Account Settings"
          >
            {avatarUrl || defaultImage ? (
              <img 
                src={avatarUrl || defaultImage} 
                alt="Profile" 
                className="h-8 w-8 rounded-full border border-neutral-800/80 object-cover shrink-0 select-none ring-2 ring-indigo-500/20 group-hover:ring-indigo-500/50 transition-all"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-neutral-850 flex items-center justify-center font-bold text-xs text-indigo-400 border border-neutral-800 uppercase shrink-0 select-none group-hover:border-indigo-500/50 transition-all">
                {(nickname || defaultName || userEmail || 'US').substring(0, 2)}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs text-neutral-200 truncate group-hover:text-indigo-300 transition-colors leading-tight">
                {nickname || defaultName || 'User Account'}
              </span>
              <span className="text-[9px] text-neutral-500 truncate leading-none mt-0.5">
                Account Settings
              </span>
            </div>
          </button>

          {/* Close Sidebar X button for both Windows and Android */}
          <button 
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-900 hover:text-white cursor-pointer shrink-0"
            title="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Button: New Chat */}
        <div className="p-3.5 pb-2 shrink-0">
          <button
            onClick={handleNewChat}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black px-4 py-3 text-sm font-semibold shadow-sm transition-all duration-200 disabled:opacity-55 cursor-pointer"
            data-testid="new-chat-button"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-black" />
            ) : (
              <Plus className="h-4 w-4 text-black" />
            )}
            New Chat
          </button>
        </div>

        {/* Specialized Agents Section (Header Dropdown Chevron Popover & Selected Custom Agent Display) */}
        <div className="px-3.5 pb-2.5 border-b border-neutral-900/60 flex flex-col max-h-[45%] shrink-0 relative" ref={agentDropdownRef}>
          <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-neutral-500 uppercase mb-2 select-none">
            <button
              type="button"
              onClick={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
              className="flex items-center gap-1.5 hover:text-neutral-200 transition-colors cursor-pointer text-left py-0.5 group"
              title="Select Specialized Agent"
            >
              <Bot className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="group-hover:text-neutral-200">Specialized Agents ({agents.length})</span>
              <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform duration-200 ${isAgentDropdownOpen ? 'rotate-180 text-indigo-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => openAgentModal(null)}
              className="p-1 rounded text-neutral-500 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer ml-auto"
              title="Create New Agent"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Cognexa Dark Theme Custom Popover Dropdown Menu */}
          {isAgentDropdownOpen && agents.length > 0 && (
            <div className="absolute top-8 left-3.5 right-3.5 z-50 rounded-xl bg-neutral-900 border border-neutral-800 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 max-h-56 overflow-y-auto scrollbar-thin">
              <div className="text-[9px] font-bold text-neutral-500 uppercase px-2 py-1 select-none border-b border-neutral-800/60 mb-1">
                Select Specialized Agent
              </div>
              {agents.map((agent) => {
                const isSelected = (selectedAgentId || agents[0]?.id) === agent.id;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => {
                      setSelectedAgentId(agent.id);
                      setIsAgentDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-left transition-all ${
                      isSelected 
                        ? 'bg-indigo-600/20 text-indigo-200 font-bold border border-indigo-500/30' 
                        : 'hover:bg-neutral-800/70 text-neutral-300 hover:text-white border border-transparent'
                    }`}
                  >
                    <span className="h-6 w-6 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xs shrink-0 overflow-hidden">
                      {agent.avatar_url && (agent.avatar_url.startsWith('data:') || agent.avatar_url.startsWith('http') || agent.avatar_url.includes('/')) ? (
                        <img 
                          src={agent.avatar_url.startsWith('data:') || agent.avatar_url.startsWith('http') ? agent.avatar_url : `https://uelvnyetowoxhuvwxzal.supabase.co/storage/v1/object/public/documents/${agent.avatar_url}`}
                          alt={agent.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{agent.avatar_url || '🤖'}</span>
                      )}
                    </span>
                    <span className="truncate flex-1">{agent.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Render ONLY the selected custom agent and its sub-chats */}
          {agents.length > 0 ? (
            (() => {
              const selectedAgent = agents.find(a => a.id === selectedAgentId) || agents[0];
              if (!selectedAgent) return null;
              const selectedAgentChats = filteredChats.filter(chat => chat.agent_id === selectedAgent.id);

              return (
                <div className="flex flex-col rounded-xl bg-neutral-900/40 border border-neutral-850/60 p-1.5">
                  <div className="group relative flex items-center rounded-lg text-xs hover:bg-neutral-850/80 text-neutral-300">
                    <button
                      onClick={() => handleAgentClick(selectedAgent.id)}
                      disabled={isStartingAgent !== null}
                      className="flex flex-1 items-center gap-2 px-2 py-1.5 overflow-hidden text-left cursor-pointer"
                    >
                      <span className="h-6 w-6 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xs shrink-0 overflow-hidden">
                        {selectedAgent.avatar_url && (selectedAgent.avatar_url.startsWith('data:') || selectedAgent.avatar_url.startsWith('http') || selectedAgent.avatar_url.includes('/')) ? (
                          <img 
                            src={selectedAgent.avatar_url.startsWith('data:') || selectedAgent.avatar_url.startsWith('http') ? selectedAgent.avatar_url : `https://uelvnyetowoxhuvwxzal.supabase.co/storage/v1/object/public/documents/${selectedAgent.avatar_url}`}
                            alt={selectedAgent.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>{selectedAgent.avatar_url || '🤖'}</span>
                        )}
                      </span>
                      <span className="truncate pr-16 font-bold text-neutral-200">{selectedAgent.name}</span>
                    </button>

                    {/* Actions: New Chat, Edit, Delete */}
                    <div className="absolute right-1.5 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleStartAgentChat(selectedAgent.id)}
                        className="rounded p-0.5 text-neutral-400 sm:text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 cursor-pointer"
                        title="New Chat with Agent"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openAgentModal(selectedAgent.id)}
                        className="rounded p-0.5 text-neutral-400 sm:text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 cursor-pointer"
                        title="Edit Agent"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteAgent(e, selectedAgent.id)}
                        className="rounded p-0.5 text-neutral-400 sm:text-neutral-500 hover:bg-neutral-800 hover:text-red-400 cursor-pointer"
                        title="Delete Agent"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Sub-chats for ONLY the selected agent */}
                  {selectedAgentChats.length > 0 && (
                    <div className="mt-1 space-y-0.5 max-h-36 overflow-y-auto scrollbar-thin pl-1">
                      {selectedAgentChats.map(renderChatItem)}
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="text-[10px] text-neutral-600 italic py-1 select-none">
              No custom agents created yet.
            </div>
          )}
        </div>

        {/* Search Input bar */}
        <div className="px-3.5 py-2 shrink-0">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search conversations"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-neutral-900 bg-neutral-900/40 pl-10 pr-4 py-2.5 text-xs text-neutral-200 placeholder-neutral-500 focus:border-neutral-800 focus:outline-none transition-colors"
              data-testid="search-chat-input"
            />
          </div>
        </div>

        {/* Recent Chats list (Flex-1 with Dedicated Independent Scroll) */}
        <div data-testid="chat-list" className="flex-1 overflow-y-auto px-2 py-2 space-y-1 scrollbar-thin min-h-0">
          <div className="px-3 mb-2 text-[10px] font-bold tracking-wider text-neutral-500 uppercase flex items-center gap-1.5 select-none">
            <FolderOpen className="w-3.5 h-3.5 text-neutral-400" />
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

        {/* Footer Sign Out Button */}
        <div className="mt-auto border-t border-neutral-900 bg-neutral-950 p-3 shrink-0">
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-between gap-2 rounded-xl bg-neutral-900 hover:bg-neutral-850 border border-neutral-800/80 px-3.5 py-2.5 text-xs text-red-400 hover:text-red-300 transition-colors font-medium cursor-pointer"
            data-testid="logout-button"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-[92%] sm:w-[420px] max-h-[90dvh] overflow-y-auto rounded-3xl border border-neutral-900 bg-neutral-950 p-6 shadow-2xl transition-all">
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
                      {(editNickname || defaultName || userEmail || 'US').substring(0, 2).toUpperCase()}
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
                      onClick={() => {
                        setMfaDisableError('');
                        setIsDisableMfaConfirmOpen(true);
                      }}
                      disabled={isDisablingMfa}
                      className="flex-1 rounded-xl bg-red-950/20 hover:bg-red-900 border border-red-900/30 text-[10px] text-red-400 hover:text-white px-3.5 py-2.5 transition-colors font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50"
                    >
                      Disable 2FA 🔒
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
                      placeholder="••••••"
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

      {/* Disable 2FA Confirmation Modal */}
      {isDisableMfaConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-[360px] rounded-3xl border border-neutral-900 bg-neutral-950 p-6 shadow-2xl transition-all">
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-2xl bg-red-950/20 border border-red-900/30 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="w-5 h-5 text-red-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider select-none">Disable 2FA?</h3>
              <p className="mt-2 text-[10px] text-neutral-550 leading-relaxed font-semibold">
                Are you sure you want to disable 2-Factor Authentication? This will make your account significantly less secure.
              </p>
            </div>

            {mfaDisableError && (
              <div className="mt-4 rounded-xl border border-red-950/40 bg-red-950/15 p-2.5 text-[9px] font-semibold text-red-400 leading-normal">
                {mfaDisableError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3 border-t border-neutral-900 pt-4">
              <button
                type="button"
                onClick={() => setIsDisableMfaConfirmOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-neutral-400 hover:bg-neutral-900 hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisableMfa}
                disabled={isDisablingMfa}
                className="rounded-xl bg-red-650 hover:bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDisablingMfa ? 'Disabling...' : 'Yes, Disable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disable 2FA Success Modal */}
      {isDisableMfaSuccessOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-[360px] rounded-3xl border border-neutral-900 bg-neutral-950 p-6 shadow-2xl transition-all">
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-2xl bg-emerald-950/20 border border-emerald-900/30 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" className="w-5 h-5 text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider select-none">MFA Disabled</h3>
              <p className="mt-2 text-[10px] text-neutral-550 leading-relaxed font-semibold">
                2-Factor Authentication has been successfully disabled from your account settings.
              </p>
            </div>

            <div className="mt-6 border-t border-neutral-900 pt-4">
              <button
                type="button"
                onClick={() => setIsDisableMfaSuccessOpen(false)}
                className="w-full rounded-xl bg-indigo-650 hover:bg-indigo-600 text-xs font-bold text-white py-2 transition-colors cursor-pointer text-center"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
