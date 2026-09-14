'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Native dialogs provide focus containment, Escape handling and an inert background. */
export function ChatDialog({ title, children, onClose, busy = false }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return (
    <dialog ref={ref} className="repo-chat-dialog" aria-label={title}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className="repo-chat-dialog-content">
        <header><h2>{title}</h2><button type="button" onClick={onClose} disabled={busy} aria-label={`Close ${title}`} className="repo-chat-icon"><X size={15} /></button></header>
        {children}
      </div>
    </dialog>
  );
}
