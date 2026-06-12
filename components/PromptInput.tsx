'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send, Loader2 } from 'lucide-react';

interface PromptInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

export default function PromptInput({ onSend, disabled }: PromptInputProps) {
  const [value, setValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

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
    if (disabled || !value.trim()) return;
    onSend(value.trim());
    setValue('');
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

  const isValueEmpty = value.trim().length === 0;

  return (
    <div className="relative w-full">
      <div className={`flex items-end gap-2 p-2 rounded-2xl border transition-all duration-300 ${
        isListening 
          ? 'border-emerald-500/50 bg-emerald-950/20 shadow-lg shadow-emerald-950/20' 
          : 'border-neutral-800 bg-neutral-900/60 focus-within:border-neutral-700 focus-within:ring-1 focus-within:ring-neutral-700'
      } backdrop-blur-md`}>
        
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
              className={`p-2 rounded-xl transition-all duration-300 ${
                isListening
                  ? 'bg-emerald-500 text-white animate-pulse'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white'
              }`}
              title="Voice Input"
            >
              <Mic className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              className="p-2 rounded-xl bg-white hover:bg-neutral-200 text-black transition-colors"
              title="Send Prompt"
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
