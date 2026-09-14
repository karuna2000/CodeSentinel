'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, FileCode2 } from 'lucide-react';
import type { EvidenceChip } from '../lib/chat-meta';

export function ChatSourceCard({ repoId, evidence, onOpen }: {
  repoId: string;
  evidence: EvidenceChip;
  onOpen: (evidence: EvidenceChip) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/github/repos/${repoId}/chat/evidence?nodeId=${encodeURIComponent(evidence.nodeId)}`, { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Source unavailable');
        const payload = await response.json();
        if (!abort.signal.aborted) setPreview(typeof payload.codeSnippet === 'string' ? payload.codeSnippet : null);
      })
      .catch(() => { if (!abort.signal.aborted) setFailed(true); });
    return () => abort.abort();
  }, [repoId, evidence.nodeId]);

  return <button type="button" className="repo-chat-source" onClick={() => onOpen(evidence)} aria-label={`Open source ${evidence.label}`}>
    <span className="repo-chat-source-label"><FileCode2 size={14} /><span className="repo-chat-source-id">{evidence.id}</span><span className="repo-chat-source-path">{evidence.filePath || evidence.nodeName}</span><span className="repo-chat-source-lines">{evidence.startLine != null ? `:${evidence.startLine}${evidence.endLine != null && evidence.endLine !== evidence.startLine ? `–${evidence.endLine}` : ''}` : ''}</span><ArrowUpRight size={14} /></span>
    <span className={`repo-chat-source-preview ${preview ? '' : 'repo-chat-source-preview--empty'}`}>{preview?.split('\n').slice(0, 3).join('\n') || (failed ? 'Preview unavailable · open source to retry' : 'Open the indexed source evidence')}</span>
  </button>;
}
