'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Cpu, Settings, Check, X, RotateCw } from 'lucide-react';
import { useModel } from '@/app/chat/LayoutClient';

export default function ModelSelector() {
  const { model, setModel, localUrl, setLocalUrl, localModel, setLocalModel } = useModel();
  const [isOpen, setIsOpen] = useState(false);
  const [tempUrl, setTempUrl] = useState(localUrl);
  const [tempModel, setTempModel] = useState(localModel);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync inputs with global state
  useEffect(() => {
    setTempUrl(localUrl);
  }, [localUrl]);

  useEffect(() => {
    setTempModel(localModel);
  }, [localModel]);

  // Fetch models from Ollama through our backend API proxy
  const fetchLocalModels = async (urlToFetch: string) => {
    if (!urlToFetch.trim()) return;
    setIsLoadingModels(true);
    setFetchError(null);
    try {
      const response = await fetch(`/api/local-models?url=${encodeURIComponent(urlToFetch.trim())}`);
      const data = await response.json();
      
      if (data.models && data.models.length > 0) {
        setAvailableModels(data.models);
        // If current model isn't in the list, choose the first downloaded one
        if (!data.models.includes(tempModel)) {
          setTempModel(data.models[0]);
        }
      } else {
        setAvailableModels([]);
        setFetchError(data.error || 'No models found. Pull some models first.');
      }
    } catch (err: any) {
      setAvailableModels([]);
      setFetchError('Failed to fetch from local Ollama endpoint.');
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Fetch local models on popover opening
  useEffect(() => {
    if (isOpen) {
      fetchLocalModels(tempUrl);
    }
  }, [isOpen]);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalUrl(tempUrl.trim());
    setLocalModel(tempModel.trim());
    setIsOpen(false);
  };

  // Trigger model fetch on Ollama URL input blur
  const handleUrlBlur = () => {
    fetchLocalModels(tempUrl);
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Sliding Capsule Selector */}
      <div className="flex p-0.5 rounded-full bg-neutral-900 border border-neutral-800 shadow-inner">
        <button
          onClick={() => setModel('gemini')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-205 cursor-pointer ${
            model === 'gemini'
              ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700/50'
              : 'text-neutral-400 hover:text-neutral-250'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Gemini API</span>
        </button>

        <button
          onClick={() => setModel('local')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-205 cursor-pointer ${
            model === 'local'
              ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700/50'
              : 'text-neutral-400 hover:text-neutral-250'
          }`}
        >
          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          <span>Local LLM</span>
        </button>
      </div>

      {/* Settings Gear (only shown when Local LLM is selected) */}
      {model === 'local' && (
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 rounded-lg border border-neutral-805 bg-neutral-900/40 hover:bg-neutral-900 text-neutral-450 hover:text-neutral-200 transition-colors shadow-sm cursor-pointer"
            title="Configure Local LLM"
          >
            <Settings className={`w-3.5 h-3.5 ${isOpen ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
          </button>

          {/* Settings Popover */}
          {isOpen && (
            <div
              ref={popoverRef}
              className="absolute right-0 mt-2 w-72 rounded-2xl border border-neutral-850 bg-neutral-950 p-4 shadow-xl z-50 text-left animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between mb-3 border-b border-neutral-900 pb-2">
                <span className="text-xs font-semibold text-neutral-250">Local LLM Config</span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-neutral-500 hover:text-neutral-300 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-550 mb-1">
                    Ollama URL
                  </label>
                  <input
                    type="text"
                    required
                    value={tempUrl}
                    onChange={(e) => setTempUrl(e.target.value)}
                    onBlur={handleUrlBlur}
                    placeholder="http://127.0.0.1:11434"
                    className="w-full text-xs rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-neutral-200 placeholder-neutral-600 focus:border-neutral-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-550 mb-1">
                    Model Selection
                  </label>
                  <div className="flex gap-1.5 items-center">
                    {availableModels.length > 0 ? (
                      <select
                        value={tempModel}
                        onChange={(e) => setTempModel(e.target.value)}
                        className="flex-1 text-xs rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-neutral-200 focus:border-neutral-700 focus:outline-none cursor-pointer"
                      >
                        {availableModels.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        value={tempModel}
                        onChange={(e) => setTempModel(e.target.value)}
                        placeholder="llama3.2"
                        className="flex-1 text-xs rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-neutral-200 placeholder-neutral-600 focus:border-neutral-700 focus:outline-none"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => fetchLocalModels(tempUrl)}
                      disabled={isLoadingModels}
                      className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200 disabled:opacity-50 cursor-pointer"
                      title="Refetch downloaded models"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isLoadingModels ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  {fetchError && (
                    <span className="block mt-1 text-[9px] text-amber-500 font-medium leading-tight">
                      ⚠️ {fetchError} (showing text fallback)
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-650 hover:bg-indigo-600 text-white py-1.5 text-xs font-semibold shadow transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Settings
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
