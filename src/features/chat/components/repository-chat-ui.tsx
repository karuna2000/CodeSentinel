'use client';

import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, User, FileCode, Loader2, Clipboard, Check, RefreshCw } from 'lucide-react';

interface RepositoryChatUIProps {
  repoId: string;
}

interface CitationChip {
  id?: string;
  label: string;
  nodeName?: string;
  filePath?: string | null;
  startLine?: number | null;
  endLine?: number | null;
}

export function RepositoryChatUI({ repoId }: RepositoryChatUIProps) {
  const [citationsMap, setCitationsMap] = useState<Record<string, CitationChip[]>>({});

  const transport = useMemo(
    () => new TextStreamChatTransport({ 
      api: `/api/github/repos/${repoId}/chat`,
      fetch: async (input, init) => {
        const res = await fetch(input, init);
        const citationsHeader = res.headers.get('x-citations');
        if (citationsHeader && init?.body) {
          try {
            const parsedCitations = JSON.parse(atob(citationsHeader));
            const body = JSON.parse(init.body as string);
            const messages = body.messages || [];
            const lastUserMsg = messages[messages.length - 1];
            if (lastUserMsg && lastUserMsg.id) {
              const chips: CitationChip[] = Array.isArray(parsedCitations)
                ? parsedCitations.map(c => typeof c === 'string' ? { label: c } : c as CitationChip)
                : [];
              setCitationsMap(prev => ({ ...prev, [lastUserMsg.id]: chips }));
            }
          } catch (e) {
            console.error('Failed to parse citations header', e);
          }
        }
        return res;
      }
    }),
    [repoId]
  );
  
  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    onFinish: ({ message }) => {
      // Surface lazy stream failures: the route appends a sentinel to the text
      // stream when the provider errors mid-stream (after the 200 is already sent).
      const text = extractText(message);
      const markerIdx = text.indexOf('[__STREAM_ERROR__]');
      if (markerIdx === -1) return;

      const cleanText = text.slice(0, markerIdx).trim();
      const errorMsg = text.slice(markerIdx + '[__STREAM_ERROR__]'.length).trim();
      setMessages((prev) => {
        const arr = [...prev];
        const last = arr[arr.length - 1];
        if (last && last.role === 'assistant') {
          arr[arr.length - 1] = { ...last, parts: [{ type: 'text', text: cleanText }] };
        }
        return arr;
      });
      showToast(errorMsg || 'The model stream failed mid-response. Please try again.', 'error');
    },
  });
  const isLoading = status === 'streaming' || status === 'submitted';

  const [localInput, setLocalInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [promotingMessageId, setPromotingMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error';
    link?: { label: string; href: string };
  } | null>(null);

  const extractText = (msg: { parts?: Array<{ type: string; text?: string }>; content?: string }) =>
    msg.parts
      ? msg.parts.filter((p: { type: string; text?: string }) => p.type === 'text').map(p => p.text ?? '').join('')
      : (msg.content ?? '');

  const showToast = (
    text: string,
    type: 'success' | 'error' = 'success',
    link?: { label: string; href: string },
  ) => {
    setToastMessage({ text, type, link });
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!localInput.trim()) return;
    if (sendMessage) {
      sendMessage({ text: localInput.trim() });
    }
    setLocalInput('');
  };

  const handlePromote = async (messageId: string, answer: string) => {
    const msgIndex = messages.findIndex(msg => msg.id === messageId);
    const prevMsg = msgIndex > 0 ? messages[msgIndex - 1] : null;
    
    if (!prevMsg || prevMsg.role !== 'user') {
      showToast('No user question found to promote', 'error');
      return;
    }

    setPromotingMessageId(messageId);
    try {
      // AI SDK v6 text content fallback
      const questionText = extractText(prevMsg);

      const res = await fetch(`/api/github/repos/${repoId}/wiki/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionText,
          answer: answer
        }),
      });
      const data = await res.json();
      if (data.success) {
        const wikiPath = (data.path || '')
          .replace(/\.md$/, '')
          .split('/')
          .map(encodeURIComponent)
          .join('/');
        showToast(
          '✨ Promoted to Wiki Insights!',
          'success',
          { label: 'View in Wiki', href: `/dashboard/repos/${repoId}/wiki/${wikiPath}` }
        );
      } else {
        showToast(data.error || 'Failed to promote', 'error');
      }
    } catch {
      showToast('Error promoting to wiki', 'error');
    } finally {
      setPromotingMessageId(null);
    }
  };

  const handleCopy = async (messageId: string, text: string) => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast('Failed to copy message', 'error');
    }
  };

  const handleRegenerate = () => {
    if (isLoading) return;
    const lastUserIndex = messages.reduce(
      (acc, m, i) => (m.role === 'user' ? i : acc),
      -1,
    );
    if (lastUserIndex === -1) return;
    const lastUser = messages[lastUserIndex];
    const text = extractText(lastUser);
    setMessages(prev => prev.slice(0, lastUserIndex + 1));
    sendMessage({ text });
  };

  return (
    <div className="flex flex-col h-full bg-[#f5f0e8] relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-24 right-8 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-4 flex items-center gap-3 ${
          toastMessage.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          <span>{toastMessage.text}</span>
          {toastMessage.link && (
            <a
              href={toastMessage.link.href}
              className="px-2.5 py-1 rounded-md bg-white/70 border border-green-300 text-green-700 hover:bg-white transition-colors text-xs font-semibold"
            >
              {toastMessage.link.label}
            </a>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 max-w-lg mx-auto text-center">
            <Bot className="w-12 h-12 mb-4 text-orange-400 opacity-50" />
            <h2 className="text-xl font-semibold mb-2">Welcome to Repository Chat!</h2>
            <p>I have indexed this repository into a searchable graph. You can ask me anything about its architecture, components, or specific logic.</p>
            <div className="flex gap-2 mt-6 flex-wrap justify-center">
              <button onClick={() => setLocalInput("Where is the database logic?")} className="px-3 py-1 bg-white/50 border border-gray-300 rounded-full text-sm hover:bg-white transition-colors cursor-pointer">&quot;Where is the database logic?&quot;</button>
              <button onClick={() => setLocalInput("How does authentication work?")} className="px-3 py-1 bg-white/50 border border-gray-300 rounded-full text-sm hover:bg-white transition-colors cursor-pointer">&quot;How does authentication work?&quot;</button>
              <button onClick={() => setLocalInput("Trace the user signup flow")} className="px-3 py-1 bg-white/50 border border-gray-300 rounded-full text-sm hover:bg-white transition-colors cursor-pointer">&quot;Trace the user signup flow&quot;</button>
            </div>
          </div>
        )}
        
        {messages.map(m => (
          <div key={m.id} className={`flex gap-4 max-w-4xl mx-auto w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role !== 'user' && (
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 border border-orange-200">
                <Bot className="w-5 h-5 text-orange-600" />
              </div>
            )}
            
            <div className={`flex flex-col gap-2 max-w-[80%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-5 py-3 rounded-2xl shadow-sm prose prose-sm max-w-none break-words ${
                m.role === 'user' 
                  ? 'bg-gray-800 text-white prose-invert' 
                  : 'bg-white border border-gray-200 text-gray-800'
              }`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {extractText(m)}
                </ReactMarkdown>
              </div>
              
              {/* Citations + Actions UI */}
              {m.role !== 'user' && (() => {
                // Find the previous user message to lookup citations
                const msgIndex = messages.findIndex(msg => msg.id === m.id);
                const prevMsg = msgIndex > 0 ? messages[msgIndex - 1] : null;
                const citations = prevMsg ? citationsMap[prevMsg.id] : null;
                const isLastAssistant = messages[messages.length - 1]?.id === m.id;

                return (
                  <div className="mt-2 flex flex-col gap-3">
                    {citations && citations.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {citations.map((citation, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-md shadow-sm text-xs text-gray-600">
                            <FileCode className="w-3.5 h-3.5 text-orange-500" />
                            <span className="truncate max-w-[200px]" title={citation.nodeName ?? citation.label}>{citation.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {status !== 'streaming' && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleCopy(m.id, extractText(m))}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 transition flex items-center gap-1.5"
                          title="Copy answer"
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check className="w-3 h-3" /> Copied!
                            </>
                          ) : (
                            <>
                              <Clipboard className="w-3 h-3" /> Copy
                            </>
                          )}
                        </button>

                        {isLastAssistant && (
                          <button
                            onClick={handleRegenerate}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 transition flex items-center gap-1.5"
                            title="Regenerate answer"
                          >
                            <RefreshCw className="w-3 h-3" /> Regenerate
                          </button>
                        )}

                        <button
                          onClick={() => handlePromote(m.id, extractText(m))}
                          disabled={promotingMessageId === m.id}
                          className="self-start px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {promotingMessageId === m.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Promoting...
                            </>
                          ) : (
                            <>
                              ✨ Promote to Wiki
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0 border border-gray-300">
                <User className="w-5 h-5 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === 'user' && (
           <div className="flex gap-4 max-w-4xl mx-auto w-full justify-start">
             <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 border border-orange-200">
               <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
             </div>
             <div className="px-5 py-3 rounded-2xl shadow-sm bg-white border border-gray-200 text-gray-800 flex items-center gap-2 text-sm text-gray-500">
                Searching codebase and analyzing...
             </div>
           </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white/80 backdrop-blur-md border-t border-gray-200 sticky bottom-0">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="max-w-4xl mx-auto relative flex items-end shadow-sm rounded-xl border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-orange-500/50 transition-shadow">
          <textarea
            className="w-full resize-none bg-transparent p-4 outline-none text-gray-800 placeholder:text-gray-400 min-h-[56px] max-h-48 overflow-y-auto rounded-l-xl"
            placeholder="Ask about the codebase..."
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button 
            type="submit" 
            disabled={isLoading || !localInput.trim()}
            className="p-4 text-orange-600 hover:text-orange-700 disabled:text-gray-400 transition-colors rounded-r-xl focus:outline-none"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-2">
          AI Codebase Assistant uses hybrid retrieval (BM25 + Semantic Search + Graph Traversal)
        </p>
      </div>
    </div>
  );
}
