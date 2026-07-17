'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send, Loader2, Paperclip, FileText, X } from 'lucide-react';

export interface PromptInputProps {
  onSend: (text: string, file?: File) => void;
  disabled: boolean;
  chatId?: string;
  onUploadSuccess?: () => void;
}

export default function PromptInput({ onSend, disabled, chatId, onUploadSuccess }: PromptInputProps) {
  const [value, setValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePaperclipClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert('File size exceeds the 10MB limit. Please upload a smaller file.');
      return;
    }

    // Validate supported formats (PDF, text-based, Word, Excel)
    const isPDF = file.type === 'application/pdf';
    const isOffice = /\.(docx|doc|xlsx|xls|csv)$/i.test(file.name) ||
                     [
                       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                       'application/msword',
                       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                       'application/vnd.ms-excel',
                       'text/csv'
                     ].includes(file.type);
    const isText = file.type.startsWith('text/') || 
                   /\.(txt|md|js|jsx|ts|tsx|py|json|html|css)$/i.test(file.name);

    if (!isPDF && !isText && !isOffice) {
      alert('Unsupported file format. Please upload a PDF, Word (docx), Excel (xlsx), CSV, or text-based document.');
      return;
    }

    if (chatId) {
      // Inside active chat: upload immediately
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chatId', chatId);

      try {
        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to upload document');
        }

        if (onUploadSuccess) {
          onUploadSuccess();
        }
      } catch (err: any) {
        console.error(err);
        alert(`Upload failed: ${err.message}`);
      } finally {
        setIsUploading(false);
      }
    } else {
      // Landing page: save in local state for deferred upload
      setSelectedFile(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveSelectedFile = () => {
    setSelectedFile(null);
  };

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => {
          setIsListening(true);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        rec.onerror = (e: any) => {
          console.error('Speech recognition error:', e);
          setIsListening(false);
        };

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setValue((prev) => {
              const trimmedPrev = prev.trim();
              return trimmedPrev ? `${trimmedPrev} ${transcript}` : transcript;
            });
          }
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  const handleSpeechToggle = () => {
    if (!recognitionRef.current) {
      alert('Voice input is not supported in this browser. Please try Chrome, Edge, or Safari.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (disabled || (!value.trim() && !selectedFile)) return;
    onSend(value.trim(), selectedFile || undefined);
    setValue('');
    setSelectedFile(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Adjust height on text change
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const isValueEmpty = value.trim().length === 0 && !selectedFile;

  return (
    <div className="relative w-full">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,text/*,.js,.ts,.tsx,.jsx,.py,.csv,.json,.html,.css,.docx,.doc,.xlsx,.xls"
      />

      {/* Local selected file preview (Landing Page) */}
      {selectedFile && (
        <div className="mb-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 font-medium max-w-max select-none shadow-sm animate-fade-in">
          <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="truncate max-w-[150px]" title={selectedFile.name}>
            {selectedFile.name}
          </span>
          <button
            type="button"
            onClick={handleRemoveSelectedFile}
            className="p-0.5 rounded-md text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
            title="Remove file"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className={`flex items-end gap-2 p-2 rounded-2xl border transition-all duration-300 ${isListening
        ? 'border-emerald-500/50 bg-emerald-950/20 shadow-lg shadow-emerald-950/20'
        : 'border-neutral-800 bg-neutral-900/60 focus-within:border-neutral-700 focus-within:ring-1 focus-within:ring-neutral-700'
        } backdrop-blur-md`}>

        {/* Paperclip upload button */}
        <button
          type="button"
          onClick={handlePaperclipClick}
          disabled={disabled || isUploading}
          className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all duration-300 self-center disabled:opacity-50 cursor-pointer shrink-0"
          title="Upload document for RAG search (PDF, Text, Code)"
        >
          {isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          ) : (
            <Paperclip className="w-5 h-5" />
          )}
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? "Listening... Speak now." : "Ask anything"}
          disabled={disabled}
          className="flex-1 max-h-48 resize-none bg-transparent py-2 px-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none disabled:opacity-50"
          style={{ minHeight: '38px' }}
          data-testid="chat-input"
        />

        <div className="flex items-center gap-1.5 self-center pr-1">
          {disabled ? (
            <div className="p-2 rounded-xl bg-neutral-800 text-neutral-500">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : isValueEmpty ? (
            <button
              type="button"
              onClick={handleSpeechToggle}
              className={`p-2 rounded-xl transition-all duration-300 ${isListening
                ? 'bg-emerald-500 text-white animate-pulse'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white'
                }`}
              title="Voice Input"
              data-testid="microphone-button"
            >
              <Mic className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              className="p-2 rounded-xl bg-white hover:bg-neutral-200 text-black transition-colors"
              title="Send Prompt"
              data-testid="send-button"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      {isListening && (
        <span className="absolute -top-6 left-3 text-xs font-medium text-emerald-400">
          Recording audio... Click mic to stop
        </span>
      )}
    </div>
  );
}
