'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Bot, Brain, FileText, UploadCloud, Trash2, 
  Plus, Loader2, Sparkles, AlertCircle, CheckCircle, 
  Cpu, Layout, MessageSquare, Compass, Eye, Shield
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId?: string | null; // Null means create mode
  onSaveSuccess: () => void;
}

interface DocumentMeta {
  id: string;
  name: string;
  mime_type: string;
  storage_path: string;
  created_at: string;
}

const EMOJI_AVATARS = ['🤖', '💻', '⚖️', '👨‍💼', '👩‍⚕️', '🎨', '📈', '🛠️', '🕵️', '🎓'];

export default function AgentModal({ isOpen, onClose, agentId, onSaveSuccess }: AgentModalProps) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'info' | 'kb'>('info');

  // Agent Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [preferredModel, setPreferredModel] = useState<'gemini' | 'local'>('gemini');
  const [localModelName, setLocalModelName] = useState('llama3.2');
  const [avatarType, setAvatarType] = useState<'emoji' | 'upload'>('emoji');
  const [selectedEmoji, setSelectedEmoji] = useState('🤖');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [starters, setStarters] = useState<string[]>(['', '', '']);

  // UI Control State
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingStarters, setIsGeneratingStarters] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Knowledge Base State
  const [kbDocs, setKbDocs] = useState<DocumentMeta[]>([]);
  const [isKbLoading, setIsKbLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Local model options
  const [availableLocalModels, setAvailableLocalModels] = useState<string[]>([]);
  const [ollamaUrl, setOllamaUrl] = useState('http://127.0.0.1:11434');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    window.dispatchEvent(new Event('agent-settings-updated'));
    onClose();
  };

  // Load Agent Details if in edit mode
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSuccess(null);
    setActiveTab('info');
    setUploadProgress(null);

    // Fetch local models
    fetchLocalModels();

    if (agentId) {
      fetchAgentDetails(agentId);
      fetchAgentDocuments(agentId);
    } else {
      // Clear Form for Create Mode
      setName('');
      setDescription('');
      setSystemPrompt('');
      setPreferredModel('gemini');
      setLocalModelName('llama3.2');
      setAvatarType('emoji');
      setSelectedEmoji('🤖');
      setAvatarUrl('');
      setStarters(['', '', '']);
      setKbDocs([]);
    }
  }, [isOpen, agentId]);

  const fetchLocalModels = async () => {
    try {
      const response = await fetch(`/api/local-models?url=${encodeURIComponent(ollamaUrl)}`);
      const data = await response.json();
      if (data.models && data.models.length > 0) {
        setAvailableLocalModels(data.models);
      }
    } catch (err) {
      console.warn('Failed to fetch local models inside modal:', err);
    }
  };

  const fetchAgentDetails = async (id: string) => {
    try {
      const response = await fetch(`/api/agents/${id}`);
      if (!response.ok) throw new Error('Failed to load agent settings');
      const data = await response.json();
      const agent = data.agent;

      setName(agent.name);
      setDescription(agent.description || '');
      setSystemPrompt(agent.system_prompt || '');
      setPreferredModel(agent.preferred_model === 'local' ? 'local' : 'gemini');
      setLocalModelName(agent.local_model_name || 'llama3.2');
      
      // starters
      const savedStarters = agent.conversation_starters || [];
      const startersList = [...savedStarters];
      while (startersList.length < 3) startersList.push('');
      setStarters(startersList);

      // avatar
      if (agent.avatar_url && EMOJI_AVATARS.includes(agent.avatar_url)) {
        setAvatarType('emoji');
        setSelectedEmoji(agent.avatar_url);
        setAvatarUrl('');
      } else if (agent.avatar_url) {
        setAvatarType('upload');
        setAvatarUrl(agent.avatar_url);
      } else {
        setAvatarType('emoji');
        setSelectedEmoji('🤖');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve agent details.');
    }
  };

  const fetchAgentDocuments = async (id: string) => {
    setIsKbLoading(true);
    try {
      const response = await fetch(`/api/documents/list?agentId=${id}`);
      if (response.ok) {
        const data = await response.json();
        setKbDocs(data.documents || []);
      }
    } catch (err) {
      console.error('Failed to load knowledge base:', err);
    } finally {
      setIsKbLoading(false);
    }
  };

  // Handle Starter prompts edits
  const handleStarterChange = (index: number, val: string) => {
    const updated = [...starters];
    updated[index] = val;
    setStarters(updated);
  };

  const handleAddStarter = () => {
    if (starters.length >= 5) return;
    setStarters([...starters, '']);
  };

  const handleRemoveStarter = (index: number) => {
    if (starters.length <= 1) return;
    const updated = starters.filter((_, idx) => idx !== index);
    setStarters(updated);
  };

  // Generate Prompts using LLM
  const handleAutoSuggestStarters = async () => {
    if (!name.trim()) {
      setError('Please provide an agent name first to auto-generate starters.');
      return;
    }

    setIsGeneratingStarters(true);
    setError(null);
    try {
      const response = await fetch('/api/agents/generate-starters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleName: name,
          roleDescription: description,
          systemPrompt: systemPrompt,
          preferredModel: preferredModel,
          localModelName: localModelName
        })
      });

      if (!response.ok) throw new Error('Starters generation failed.');
      const data = await response.json();
      
      const newStarters = data.starters || [];
      while (newStarters.length < 3) newStarters.push('');
      setStarters(newStarters);
      setSuccess('Auto-suggested starters generated successfully!');
    } catch (err: any) {
      setError('Failed to generate starters dynamically: ' + err.message);
    } finally {
      setIsGeneratingStarters(false);
    }
  };

  // Handle Custom Avatar Image Upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User session not found.');

      // Upload avatar to documents bucket under users folder
      const timestamp = Date.now();
      const filename = `avatar_${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const storagePath = `${user.id}/avatars/${filename}`;

      const { data, error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadErr) throw uploadErr;

      setAvatarUrl(storagePath);
      setAvatarType('upload');
      setSuccess('Custom avatar uploaded successfully.');
    } catch (err: any) {
      setError('Avatar upload failed: ' + err.message);
    }
  };

  // Submit Main Profile Info
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Agent name is required');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const finalAvatar = avatarType === 'emoji' ? selectedEmoji : avatarUrl;
    const cleanStarters = starters.map(s => s.trim()).filter(Boolean);

    const payload = {
      name,
      description,
      system_prompt: systemPrompt,
      preferred_model: preferredModel,
      local_model_name: preferredModel === 'local' ? localModelName : null,
      avatar_url: finalAvatar,
      conversation_starters: cleanStarters
    };

    try {
      const url = agentId ? `/api/agents/${agentId}` : '/api/agents';
      const method = agentId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to save agent settings.');
      }

      const resData = await response.json();
      setSuccess('Agent profile saved successfully!');
      onSaveSuccess();
      window.dispatchEvent(new Event('agent-settings-updated'));

      // If we created a new agent, swap to edit mode so user can upload documents
      if (!agentId && resData.agent?.id) {
        // Rather than closing, let's refresh settings and point to the newly created ID
        // so they can upload documents. But standard flow is fine.
        handleClose();
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  // KB Document Management
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await uploadKBFiles(files);
    }
  };

  const uploadKBFiles = async (files: FileList) => {
    if (!agentId) {
      setError('You must save the Agent profile first before uploading knowledge documents.');
      return;
    }

    setUploadProgress(0);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('agentId', agentId);

        // Calculate progress increments
        setUploadProgress(Math.round(((i + 0.1) / files.length) * 100));

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || `Failed to upload file ${file.name}`);
        }
      }

      setUploadProgress(100);
      setSuccess('Knowledge documents processed and vectorized successfully!');
      setTimeout(() => setUploadProgress(null), 2000);
      fetchAgentDocuments(agentId);
      window.dispatchEvent(new Event('agent-settings-updated'));
    } catch (err: any) {
      setError(err.message || 'Document ingestion failed.');
      setUploadProgress(null);
    }
  };

  const handleDeleteKB = async (docId: string) => {
    if (!confirm('Are you sure you want to remove this document from the agent knowledge base?')) return;
    setError(null);

    try {
      const response = await fetch('/api/documents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId })
      });

      if (response.ok) {
        setSuccess('Document removed from knowledge base.');
        if (agentId) fetchAgentDocuments(agentId);
        window.dispatchEvent(new Event('agent-settings-updated'));
      } else {
        const data = await response.json();
        setError(`Failed to delete document: ${data.error}`);
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred during deletion.');
    }
  };

  // Drag and Drop Helpers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await uploadKBFiles(files);
    }
  };

  // Storage Public URL generator (signed or fallback)
  const getAvatarPreviewUrl = (path: string) => {
    if (!path) return '';
    // Just a placeholder or public url. For real signed urls we'd fetch them,
    // but in Supabase, we can use the public URL structure if bucket policy permits,
    // or just download/fetch it. For avatar, let's display an icon or try fetching.
    return `${supabase.storage.from('documents').getPublicUrl(path).data.publicUrl}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md px-4 py-6 overflow-y-auto animate-in fade-in duration-200">
      
      {/* Modal Wrapper Box */}
      <div className="relative w-full max-w-2xl rounded-3xl border border-neutral-900 bg-neutral-950 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-900 bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-bold shadow-md">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100">
                {agentId ? `Configure Assistant: ${name}` : 'Create Specialized Assistant'}
              </h2>
              <p className="text-[10px] text-neutral-500 font-medium">
                Set up specialized system roles, preferred LLMs, and private documents.
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-905 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-neutral-900 bg-neutral-900/10 px-4">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'info' 
                ? 'border-indigo-500 text-white' 
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Brain className="w-4 h-4" />
            General Settings & AI
          </button>
          
          <button
            onClick={() => {
              if (!agentId) {
                alert('Please save the Assistant profile information first before configuring the Knowledge Base.');
                return;
              }
              setActiveTab('kb');
            }}
            disabled={!agentId}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === 'kb' 
                ? 'border-indigo-500 text-white' 
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            Knowledge Base (RAG)
            {kbDocs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-900/40 text-[9px]">
                {kbDocs.length}
              </span>
            )}
          </button>
        </div>

        {/* Inner Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#0a0a0a]/40">
          
          {/* Global Alert Notification */}
          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-950/40 bg-red-950/15 p-4 text-xs text-red-400">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-950/40 bg-emerald-950/15 p-4 text-xs text-emerald-400">
              <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="flex-1 font-medium">{success}</div>
            </div>
          )}

          {/* TAB 1: GENERAL PROFILE INFO */}
          {activeTab === 'info' && (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              
              {/* Profile Header Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* Profile Picture Upload Section */}
                <div className="md:col-span-1 border border-neutral-900 rounded-2xl p-4 bg-neutral-950/50 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-bold text-neutral-550 uppercase tracking-wider mb-2">Avatar Represent</span>
                  
                  {avatarType === 'emoji' ? (
                    <div className="h-16 w-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-3xl shadow-inner select-none mb-3">
                      {selectedEmoji}
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden shadow-inner mb-3">
                      {avatarUrl ? (
                        <img 
                          src={getAvatarPreviewUrl(avatarUrl)} 
                          alt="Avatar Preview" 
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            // Fallback if public url is not loadable directly due to private bucket
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = '<span class="text-xs text-neutral-500 font-semibold">Avatar</span>';
                          }}
                        />
                      ) : (
                        <Bot className="w-8 h-8 text-neutral-500" />
                      )}
                    </div>
                  )}

                  {/* Selector Modes */}
                  <div className="flex gap-1.5 p-0.5 rounded-lg bg-neutral-900 border border-neutral-850 shadow-inner w-full mb-3.5">
                    <button
                      type="button"
                      onClick={() => setAvatarType('emoji')}
                      className={`flex-1 text-[9px] font-semibold py-1 rounded cursor-pointer transition-all ${
                        avatarType === 'emoji' ? 'bg-neutral-800 text-white' : 'text-neutral-500'
                      }`}
                    >
                      Emojis
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarType('upload')}
                      className={`flex-1 text-[9px] font-semibold py-1 rounded cursor-pointer transition-all ${
                        avatarType === 'upload' ? 'bg-neutral-800 text-white' : 'text-neutral-500'
                      }`}
                    >
                      Custom Image
                    </button>
                  </div>

                  {avatarType === 'emoji' ? (
                    <div className="grid grid-cols-5 gap-1.5 justify-center">
                      {EMOJI_AVATARS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setSelectedEmoji(emoji)}
                          className={`text-base p-1.5 rounded-lg hover:bg-neutral-800 cursor-pointer select-none transition-colors ${
                            selectedEmoji === emoji ? 'bg-neutral-800 border border-neutral-700/50' : 'border border-transparent'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        ref={avatarInputRef}
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white text-[10px] font-semibold cursor-pointer transition-colors"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        Select File
                      </button>
                    </div>
                  )}
                </div>

                {/* Name and Description Inputs */}
                <div className="md:col-span-2 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                      Assistant Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Senior Software Dev, Marketing Coach"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full text-xs rounded-xl border border-neutral-900 bg-neutral-900/40 px-4 py-3 text-neutral-200 placeholder-neutral-600 focus:border-neutral-800 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                      Short Description / Bio
                    </label>
                    <textarea
                      placeholder="Explain what this specialized agent does..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full text-xs rounded-xl border border-neutral-900 bg-neutral-900/40 px-4 py-3 text-neutral-200 placeholder-neutral-600 focus:border-neutral-800 focus:outline-none resize-none"
                    />
                  </div>
                </div>

              </div>

              {/* Model Choice config */}
              <div className="border border-neutral-900 rounded-2xl p-4 bg-neutral-950/40 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-neutral-200">AI Model Preference</span>
                  </div>
                  
                  {/* Selector capsules */}
                  <div className="flex p-0.5 rounded-full bg-neutral-900 border border-neutral-800 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setPreferredModel('gemini')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                        preferredModel === 'gemini' 
                          ? 'bg-neutral-850 text-white border border-neutral-750' 
                          : 'text-neutral-500 hover:text-neutral-350'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                      Gemini API
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreferredModel('local')}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                        preferredModel === 'local' 
                          ? 'bg-neutral-850 text-white border border-neutral-750' 
                          : 'text-neutral-500 hover:text-neutral-350'
                      }`}
                    >
                      <Cpu className="w-3 h-3 text-emerald-400" />
                      Local Ollama
                    </button>
                  </div>
                </div>

                {preferredModel === 'local' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2 border-t border-neutral-900">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                        Ollama Endpoint
                      </label>
                      <input
                        type="text"
                        value={ollamaUrl}
                        onChange={(e) => setOllamaUrl(e.target.value)}
                        onBlur={fetchLocalModels}
                        className="w-full text-xs rounded-lg border border-neutral-900 bg-neutral-900/60 px-3 py-2 text-neutral-300 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                        Active Tag
                      </label>
                      {availableLocalModels.length > 0 ? (
                        <select
                          value={localModelName}
                          onChange={(e) => setLocalModelName(e.target.value)}
                          className="w-full text-xs rounded-lg border border-neutral-900 bg-neutral-900/60 px-3 py-2 text-neutral-300 focus:outline-none cursor-pointer"
                        >
                          {availableLocalModels.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={localModelName}
                          onChange={(e) => setLocalModelName(e.target.value)}
                          placeholder="llama3.2"
                          className="w-full text-xs rounded-lg border border-neutral-900 bg-neutral-900/60 px-3 py-2 text-neutral-300 focus:outline-none"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* System Instructions / Prompt */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase flex items-center justify-between">
                  <span>System Instructions / Prompt Role</span>
                  <span className="text-[9px] lowercase italic text-neutral-600 font-normal">Controls how the model behaves and responds</span>
                </label>
                <textarea
                  required
                  placeholder="e.g. You are a senior React developer. When asked coding questions, explain the architecture first, then write clean TypeScript code with comments. Always maintain a professional, helpful tone..."
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={5}
                  className="w-full text-xs rounded-xl border border-neutral-900 bg-neutral-900/40 px-4 py-3 text-neutral-200 placeholder-neutral-600 focus:border-neutral-800 focus:outline-none"
                />
              </div>

              {/* Conversation Starters Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                  <label className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Conversation Starters
                  </label>
                  
                  <button
                    type="button"
                    onClick={handleAutoSuggestStarters}
                    disabled={isGeneratingStarters}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-800 bg-neutral-900 hover:text-indigo-400 hover:border-neutral-700/80 disabled:opacity-50 text-[10px] font-semibold text-neutral-350 cursor-pointer transition-all"
                  >
                    {isGeneratingStarters ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    Auto-suggest
                  </button>
                </div>

                <div className="space-y-2.5">
                  {starters.map((starter, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        placeholder={`Starter prompt ${index + 1} (e.g. Explain Docker networking)`}
                        value={starter}
                        onChange={(e) => handleStarterChange(index, e.target.value)}
                        className="flex-1 text-xs rounded-xl border border-neutral-900 bg-neutral-900/30 px-3.5 py-2.5 text-neutral-255 placeholder-neutral-600 focus:border-neutral-800 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveStarter(index)}
                        disabled={starters.length <= 1}
                        className="p-2.5 rounded-xl border border-neutral-900 bg-neutral-900 hover:bg-neutral-900 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors text-neutral-500 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {starters.length < 5 && (
                  <button
                    type="button"
                    onClick={handleAddStarter}
                    className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-350 font-medium px-1.5 py-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add starter prompt
                  </button>
                )}
              </div>

              {/* Bottom Actions Row */}
              <div className="pt-4 border-t border-neutral-900 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 rounded-xl border border-neutral-800 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-neutral-200 text-black px-5 py-2.5 text-xs font-bold transition-all shadow-md disabled:opacity-55 cursor-pointer"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin text-black" />}
                  {agentId ? 'Update Settings' : 'Create Assistant'}
                </button>
              </div>

            </form>
          )}

          {/* TAB 2: KNOWLEDGE BASE DOCUMENTS */}
          {activeTab === 'kb' && (
            <div className="space-y-5">
              
              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
                  isDragging 
                    ? 'border-indigo-500 bg-indigo-950/10' 
                    : 'border-neutral-800 bg-neutral-950/20 hover:border-neutral-700/80'
                }`}
              >
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,text/*,.js,.ts,.tsx,.jsx,.py,.csv,.json,.html,.css,.docx,.doc,.xlsx,.xls"
                />
                
                <div className="p-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-indigo-400 mb-4 shadow-sm">
                  <UploadCloud className="w-6 h-6" />
                </div>
                
                <h3 className="text-xs font-bold text-neutral-200 mb-1">
                  Drag & Drop Knowledge files here
                </h3>
                <p className="text-[10px] text-neutral-500 max-w-xs leading-normal">
                  Upload PDFs, Word (docx), Excel (xlsx), CSV, or text-based documents. They will be recursively parsed, chunked, and stored in the Agent's Vector space.
                </p>

                {uploadProgress !== null && (
                  <div className="mt-4 w-full max-w-xs space-y-1.5">
                    <div className="flex justify-between text-[9px] text-neutral-400 font-semibold">
                      <span>Processing embeddings...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-indigo-500 h-1.5 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Uploaded Documents List */}
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase select-none">
                  Uploaded Documents ({kbDocs.length})
                </h4>

                {isKbLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-neutral-600" />
                  </div>
                ) : kbDocs.length === 0 ? (
                  <div className="border border-neutral-900/60 rounded-2xl p-6 text-center text-xs text-neutral-600 italic bg-neutral-950/10">
                    No private knowledge documents uploaded for this assistant yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {kbDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3.5 rounded-2xl border border-neutral-900 bg-neutral-950/30 hover:bg-neutral-900/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-4">
                          <div className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-indigo-400 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold text-neutral-200 truncate" title={doc.name}>
                              {doc.name}
                            </span>
                            <span className="text-[9px] text-neutral-550 mt-0.5 uppercase tracking-wide">
                              {doc.mime_type.split('/')[1] || 'document'} • {new Date(doc.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteKB(doc.id)}
                          className="p-2 rounded-xl border border-transparent hover:border-neutral-900 text-neutral-500 hover:text-red-400 cursor-pointer hover:bg-neutral-900 transition-all shrink-0"
                          title="Remove document from agent knowledge"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
