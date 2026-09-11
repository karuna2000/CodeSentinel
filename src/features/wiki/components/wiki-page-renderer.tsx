'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';
import { Pencil, X, Save, Loader2, Clock } from 'lucide-react';
import { DiagramViewer } from './diagram-viewer';

interface WikiPageRendererProps {
  title: string;
  content: string;
  updatedAt: string;
  /** The wiki page path used to construct the save endpoint (e.g. "src/features/auth") */
  path: string;
  repoId: string;
  /** True when this page was generated from an older index than the repo's current HEAD. */
  stale?: boolean;
  /** Optional: callback invoked after a successful edit save */
  onContentUpdated?: () => void;
}

export function WikiPageRenderer({
  title,
  content,
  updatedAt,
  path,
  repoId,
  stale,
  onContentUpdated,
}: WikiPageRendererProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const startEdit = () => {
    setDraft(content);
    setEditError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraft(content);
    setEditError(null);
    setIsEditing(false);
  };

  const saveEdit = async () => {
    if (!draft.trim()) {
      setEditError('Content cannot be empty.');
      return;
    }

    setIsSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/github/repos/${repoId}/wiki/${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft, title }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save page');
      }

      setIsEditing(false);
      onContentUpdated?.();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save page');
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <article className="wiki-article">
        <header className="wiki-article-header">
          <h1 className="wiki-article-title">{title}</h1>
        </header>

        <div className="wiki-edit-pane">
          <textarea
            className="wiki-edit-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            aria-label="Wiki page content (Markdown)"
          />
          {editError && <p className="wiki-edit-error">{editError}</p>}
          <div className="wiki-edit-actions">
            <button
              className="wiki-btn wiki-btn--primary"
              onClick={saveEdit}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="wiki-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save size={14} /> Save
                </>
              )}
            </button>
            <button className="wiki-btn" onClick={cancelEdit} disabled={isSaving}>
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="wiki-article">
      <header className="wiki-article-header">
        <div className="wiki-article-title-row">
          <h1 className="wiki-article-title">{title}</h1>
          {stale && (
            <span className="wiki-stale-badge" title="Generated before the latest repo sync">
              <Clock size={12} /> Stale
            </span>
          )}
          <button
            className="wiki-edit-btn"
            onClick={startEdit}
            title="Edit this page"
            aria-label="Edit this page"
          >
            <Pencil size={14} />
            Edit
          </button>
        </div>
        <p className="wiki-article-meta">
          Last updated:{' '}
          {new Date(updatedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </header>

      <div className="wiki-article-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const language = className?.replace('language-', '') ?? '';
              const codeString = String(children).replace(/\n$/, '');

              if (language === 'mermaid') {
                return <DiagramViewer mermaidSrc={codeString} />;
              }

              return (
                <code className={`wiki-code ${className ?? ''}`} {...props}>
                  {children}
                </code>
              );
            },
            pre({ children }) {
              return <pre className="wiki-pre">{children}</pre>;
            },
            h2({ children }) {
              return <h2 className="wiki-h2">{children}</h2>;
            },
            h3({ children }) {
              return <h3 className="wiki-h3">{children}</h3>;
            },
            p({ children }) {
              return <p className="wiki-p">{children}</p>;
            },
            ul({ children }) {
              return <ul className="wiki-ul">{children}</ul>;
            },
            ol({ children }) {
              return <ol className="wiki-ol">{children}</ol>;
            },
            li({ children }) {
              return <li className="wiki-li">{children}</li>;
            },
            strong({ children }) {
              return <strong className="wiki-strong">{children}</strong>;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </article>
  );
}