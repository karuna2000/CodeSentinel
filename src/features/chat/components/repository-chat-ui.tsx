'use client';

import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowUp,
  Bot,
  User,
  Loader2,
  Clipboard,
  Check,
  RefreshCw,
  PanelRight,
  X,
} from 'lucide-react';
import { EvidencePanel } from './evidence-panel';
import type { ChatMeta } from '../lib/chat-meta';
import {
  parseChatMeta,
  extractTextFromParts,
  stripStreamError,
  INTENT_LABELS,
} from '../lib/chat-meta';

interface RepositoryChatUIProps {
  repoId: string;
}

export function RepositoryChatUI({ repoId }: RepositoryChatUIProps) {
  const [metaMap, setMetaMap] = useState<Record<string, ChatMeta>>({});
  const [panelOpen, setPanelOpen] = useState(false);

  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: `/api/github/repos/${repoId}/chat`,
        fetch: async (input, init) => {
          const res = await fetch(input, init);
          const meta = parseChatMeta(res);
          if (meta && init?.body) {
            try {
              const body = JSON.parse(init.body as string);
              const messages = body.messages || [];
              const lastUserMsg = messages[messages.length - 1];
              if (lastUserMsg && lastUserMsg.id) {
                setMetaMap((prev) => ({ ...prev, [lastUserMsg.id]: meta }));
              }
            } catch {
              // Header already validated by parseChatMeta; ignore malformed bodies.
            }
          }
          return res;
        },
      }),
    [repoId],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    onError: (error) =>
      showToast(
        error.message || 'Could not send your question. Please try again.',
        'error',
      ),
    onFinish: ({ message }) => {
      // Surface lazy stream failures: the route appends a sentinel when the
      // provider errors mid-stream (after the 200 is already sent).
      const [cleanText, errorMsg] = stripStreamError(
        extractTextFromParts(message),
      );
      if (!errorMsg) return;

      setMessages((prev) => {
        const arr = [...prev];
        const last = arr[arr.length - 1];
        if (last && last.role === 'assistant') {
          arr[arr.length - 1] = {
            ...last,
            parts: [{ type: 'text', text: cleanText }],
          };
        }
        return arr;
      });
      showToast(
        errorMsg || 'The model stream failed mid-response. Please try again.',
        'error',
      );
    },
  });
  const isLoading = status === 'streaming' || status === 'submitted';

  const [localInput, setLocalInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [promotingMessageId, setPromotingMessageId] = useState<string | null>(
    null,
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error';
    link?: { label: string; href: string };
  } | null>(null);

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

  /** Per-turn meta for an assistant message = keyed by its preceding user message. */
  const metaForAssistant = (assistantId: string): ChatMeta | null => {
    const idx = messages.findIndex((m) => m.id === assistantId);
    if (idx <= 0) return null;
    const prev = messages[idx - 1];
    return prev?.role === 'user' ? (metaMap[prev.id] ?? null) : null;
  };

  const latestMeta = metaForAssistant(messages[messages.length - 1]?.id ?? '');

  const handleSend = (text?: string) => {
    const value = (text ?? localInput).trim();
    if (!value || isLoading) return;
    if (sendMessage) {
      sendMessage({ text: value });
    }
    setLocalInput('');
    setPanelOpen(false);
  };

  const handlePromote = async (messageId: string, answer: string) => {
    const msgIndex = messages.findIndex((msg) => msg.id === messageId);
    const prevMsg = msgIndex > 0 ? messages[msgIndex - 1] : null;

    if (!prevMsg || prevMsg.role !== 'user') {
      showToast('No user question found to promote', 'error');
      return;
    }

    setPromotingMessageId(messageId);
    try {
      const questionText = extractTextFromParts(prevMsg);

      const res = await fetch(`/api/github/repos/${repoId}/wiki/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: questionText, answer }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Promoted to Wiki Insights!', 'success', {
          label: 'View in Wiki',
          href: `/dashboard/repos/${repoId}/wiki?page=${encodeURIComponent(data.path || '')}`,
        });
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
    const text = extractTextFromParts(lastUser);
    setMessages((prev) => prev.slice(0, lastUserIndex + 1));
    sendMessage({ text });
  };

  const evidencePanel = (
    <EvidencePanel
      repoId={repoId}
      meta={latestMeta}
      onPickFollowUp={(q) => handleSend(q)}
    />
  );

  return (
    <div className="repository-chat flex h-full bg-white relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-24 right-8 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-4 flex items-center gap-3 ${
            toastMessage.type === 'success'
              ? 'bg-[#f5f3ff] text-[#1e5a3a] border border-[#ddd6fe]'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          <span>{toastMessage.text}</span>
          {toastMessage.link && (
            <a
              href={toastMessage.link.href}
              className="px-2.5 py-1 rounded-md bg-white/70 border border-[#b5d2bb] text-[#27272a] hover:bg-white transition-colors text-xs font-semibold"
            >
              {toastMessage.link.label}
            </a>
          )}
        </div>
      )}

      {/* Conversation column */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-[var(--brand-muted)] max-w-lg mx-auto text-center">
              <Bot className="w-12 h-12 mb-4 text-[#a1a1aa]" />
              <h2 className="text-xl font-semibold mb-2 text-[var(--brand-ink)]">
                Inspect your repository
              </h2>
              <p>
                I have indexed this repository into a searchable graph. Ask
                about a symbol, trace a flow, weigh an impact, or find a bug —
                each answer is grounded in the exact file:line evidence on the
                right.
              </p>
              <div className="flex gap-2 mt-6 flex-wrap justify-center">
                <button
                  onClick={() =>
                    setLocalInput('Where is the rate limiting implemented?')
                  }
                  className="px-3 py-1 bg-white/60 border border-[#e4e4e7] rounded-full text-sm hover:bg-white transition-colors cursor-pointer"
                >
                  &quot;Where is rate limiting implemented?&quot;
                </button>
                <button
                  onClick={() =>
                    setLocalInput('How does authentication work end to end?')
                  }
                  className="px-3 py-1 bg-white/60 border border-[#e4e4e7] rounded-full text-sm hover:bg-white transition-colors cursor-pointer"
                >
                  &quot;How does authentication work end to end?&quot;
                </button>
                <button
                  onClick={() =>
                    setLocalInput('What could break if I change the DB client?')
                  }
                  className="px-3 py-1 bg-white/60 border border-[#e4e4e7] rounded-full text-sm hover:bg-white transition-colors cursor-pointer"
                >
                  &quot;What could break if I change the DB client?&quot;
                </button>
              </div>
            </div>
          )}

          {messages.map((m) => {
            const assistantMeta =
              m.role !== 'user' ? metaForAssistant(m.id) : null;
            const isLastAssistant = messages[messages.length - 1]?.id === m.id;
            const text = extractTextFromParts(m);

            return (
              <div
                key={m.id}
                className={`flex gap-4 max-w-3xl mx-auto w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role !== 'user' && (
                  <div className="w-8 h-8 rounded-full bg-[#f5f3ff] flex items-center justify-center shrink-0 border border-[#ddd6fe]">
                    <Bot className="w-5 h-5 text-[var(--brand-green)]" />
                  </div>
                )}

                <div
                  className={`flex flex-col gap-2 max-w-[90%] sm:max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`px-5 py-4 rounded-2xl text-[13px] leading-relaxed shadow-sm prose prose-sm max-w-none break-words ${
                      m.role === 'user'
                        ? 'bg-[var(--brand-navy)] text-[#ffffff] prose-invert'
                        : 'bg-white border border-[#e4e4e7] text-[var(--brand-ink)]'
                    }`}
                  >
                    {m.role !== 'user' && (
                      <div className="mb-3 flex items-center gap-2 text-[11px] font-medium text-zinc-500">
                        <span className="text-zinc-900">CodeSentinel</span>
                        {assistantMeta && (
                          <span>
                            ·{' '}
                            {assistantMeta.status === 'grounded'
                              ? 'Grounded in your code'
                              : 'Limited evidence'}
                          </span>
                        )}
                      </div>
                    )}
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {text}
                    </ReactMarkdown>
                  </div>

                  {m.role !== 'user' && (
                    <div className="mt-2 flex flex-col gap-3">
                      {assistantMeta?.intent && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
                            {INTENT_LABELS[assistantMeta.intent]}
                          </span>
                          {assistantMeta.status !== 'grounded' && (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                              limited evidence
                            </span>
                          )}
                        </div>
                      )}

                      {status !== 'streaming' && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleCopy(m.id, text)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-[var(--brand-muted)] hover:text-[var(--brand-ink)] border border-[#e4e4e7] hover:border-[#d4d4d8] transition flex items-center gap-1.5"
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
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-[var(--brand-muted)] hover:text-[var(--brand-ink)] border border-[#e4e4e7] hover:border-[#d4d4d8] transition flex items-center gap-1.5"
                              title="Regenerate answer"
                            >
                              <RefreshCw className="w-3 h-3" /> Regenerate
                            </button>
                          )}

                          <button
                            onClick={() => handlePromote(m.id, text)}
                            disabled={promotingMessageId === m.id}
                            className="self-start px-3 py-1.5 rounded-lg text-xs font-medium bg-[#f5f3ff] text-[var(--brand-green)] hover:bg-[#ede9fe] border border-[#ddd6fe] transition flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {promotingMessageId === m.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Promoting...
                              </>
                            ) : (
                              <>
                                <SparklesMini />
                                Save to Wiki
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {m.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0 border border-[#e4e4e7]">
                    <User className="w-5 h-5 text-[var(--brand-muted)]" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-4 max-w-3xl mx-auto w-full justify-start">
              <div className="w-8 h-8 rounded-full bg-[#f5f3ff] flex items-center justify-center shrink-0 border border-[#ddd6fe]">
                <Loader2 className="w-5 h-5 text-[var(--brand-green)] animate-spin" />
              </div>
              <div className="px-5 py-3 rounded-2xl shadow-sm bg-white border border-[#e4e4e7] text-sm text-[var(--brand-muted)]">
                {status === 'streaming' ? (
                  <span className="flex items-center gap-2">
                    Streaming grounded answer…
                    <span className="flex gap-1">
                      <span className="w-1 h-1 rounded-full bg-[var(--brand-green)] animate-bounce" />
                      <span className="w-1 h-1 rounded-full bg-[var(--brand-green)] animate-bounce [animation-delay:120ms]" />
                      <span className="w-1 h-1 rounded-full bg-[var(--brand-green)] animate-bounce [animation-delay:240ms]" />
                    </span>
                  </span>
                ) : (
                  'Classifying intent and retrieving evidence…'
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white/80 backdrop-blur-md border-t border-[#e4e4e7] sticky bottom-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="max-w-3xl mx-auto relative flex items-end shadow-sm rounded-2xl border border-[#e4e4e7] bg-zinc-50 focus-within:ring-2 focus-within:ring-[var(--brand-green)]/40 transition-shadow"
          >
            <textarea
              aria-label="Ask about the codebase"
              className="text-[13px] w-full resize-none bg-transparent p-4 outline-none text-[var(--brand-ink)] placeholder:text-[var(--brand-muted)] min-h-[56px] max-h-48 overflow-y-auto rounded-l-xl"
              placeholder="Ask about the codebase..."
              value={localInput}
              onChange={(e) => setLocalInput(e.target.value)}
              rows={1}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !localInput.trim()}
              aria-label="Send message"
              className="m-2 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-900 text-white transition-colors hover:bg-zinc-700 disabled:opacity-40"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </form>
          <p className="text-center text-xs text-[var(--brand-muted)] opacity-70 mt-2">
            Answers grounded in your code with file:line evidence · Enter to
            send, Shift+Enter for a new line
          </p>
        </div>
      </div>

      {/* Desktop evidence panel */}
      <aside className="hidden xl:flex w-[260px] shrink-0">
        {evidencePanel}
      </aside>

      {/* Mobile evidence drawer toggle */}
      <button
        onClick={() => setPanelOpen((v) => !v)}
        className="xl:hidden fixed bottom-24 right-4 z-40 flex items-center gap-1.5 pl-3 pr-3.5 py-2 rounded-full bg-[var(--brand-navy)] text-[#ffffff] shadow-lg text-xs font-medium"
        aria-label="Toggle evidence panel"
      >
        <PanelRight className="w-3.5 h-3.5" />
        {latestMeta?.evidence.length != null
          ? `${latestMeta.evidence.length} sources`
          : 'Evidence'}
      </button>

      {/* Mobile evidence overlay */}
      {panelOpen && (
        <div
          className="xl:hidden fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm"
          onClick={() => setPanelOpen(false)}
        >
          <div
            className="relative w-[85%] max-w-sm h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPanelOpen(false)}
              className="absolute top-3 right-3 z-10 p-2 rounded-lg bg-white/80 border border-[#e4e4e7] text-[var(--brand-muted)] hover:text-[var(--brand-ink)] transition-colors"
              aria-label="Close evidence panel"
            >
              <X className="w-4 h-4" />
            </button>
            {evidencePanel}
          </div>
        </div>
      )}
    </div>
  );
}

function SparklesMini() {
  return <span className="text-xs leading-none">✨</span>;
}
