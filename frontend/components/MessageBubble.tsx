'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Sparkles, Copy, Check } from 'lucide-react';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

export default function MessageBubble({ role, content, createdAt }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div 
      data-testid={isUser ? 'message-user' : 'message-assistant'}
      className={`flex w-full gap-4 py-5 px-4 md:px-6 transition-all ${
        isUser ? 'bg-transparent flex-row-reverse' : 'bg-neutral-900/35 border-y border-neutral-900/50'
      }`}
    >
      {/* Avatar */}
      <div className={`flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-xl text-sm font-semibold shadow-md ${
        isUser 
          ? 'bg-neutral-800 text-neutral-200 border border-neutral-700' 
          : 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white'
      }`}>
        {isUser ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </div>

      {/* Message Body */}
      <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-2xl px-4 py-3 shadow-sm text-sm leading-relaxed ${
          isUser 
            ? 'bg-neutral-800 text-neutral-100 border border-neutral-700/60 rounded-tr-none' 
            : 'text-neutral-200 rounded-tl-none prose prose-invert max-w-none'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-neutral-300">{children}</p>,
                h1: ({ children }) => <h1 className="text-xl font-bold text-neutral-100 mt-4 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-semibold text-neutral-200 mt-3 mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-md font-medium text-neutral-300 mt-2 mb-1">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-neutral-300">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-neutral-300">{children}</ol>,
                li: ({ children }) => <li className="text-neutral-300">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-indigo-500 pl-4 py-1 my-3 bg-indigo-950/10 italic text-neutral-400 rounded-r-md">
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4 rounded-xl border border-neutral-800">
                    <table className="min-w-full divide-y divide-neutral-800 text-left text-sm">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-neutral-900/50 text-neutral-200 font-semibold">{children}</thead>,
                tbody: ({ children }) => <tbody className="divide-y divide-neutral-800 bg-neutral-950/20">{children}</tbody>,
                tr: ({ children }) => <tr className="hover:bg-neutral-900/20 transition-colors">{children}</tr>,
                th: ({ children }) => <th className="p-3 font-semibold border-b border-neutral-800">{children}</th>,
                td: ({ children }) => <td className="p-3 text-neutral-300">{children}</td>,
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const isBlock = !props.style && (match || String(children).includes('\n'));
                  return isBlock ? (
                    <CodeBlock language={match ? match[1] : 'code'} value={String(children).replace(/\n$/, '')} />
                  ) : (
                    <code className="rounded bg-neutral-800/80 px-1.5 py-0.5 font-mono text-xs text-neutral-200 border border-neutral-700/30" {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </div>

        {/* Timestamp */}
        {createdAt && (
          <span className="mt-1.5 text-[10px] text-neutral-500 px-1">
            {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}

// Inner helper component for copyable code blocks
function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code', err);
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-lg max-w-full">
      <div className="flex items-center justify-between border-b border-neutral-800/80 bg-neutral-900/80 px-4 py-2 text-xs font-mono text-neutral-400">
        <span className="uppercase text-neutral-300">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-800 hover:border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-2 py-1 text-neutral-300 hover:text-white transition-all cursor-pointer"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-neutral-200">
        <code>{value}</code>
      </pre>
    </div>
  );
}
