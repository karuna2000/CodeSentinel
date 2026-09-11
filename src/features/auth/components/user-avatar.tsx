'use client';

import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import { useState } from 'react';

interface UserAvatarProps {
  
  showSignOut?: boolean;
}

export function UserAvatar({ showSignOut = true }: UserAvatarProps) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [imageError, setImageError] = useState(false);

  if (status === 'loading') {
    return (
      <div
        aria-label="Loading user"
        className="w-[30px] h-[30px] rounded-full bg-[rgba(245,240,232,0.2)] animate-pulse"
      />
    );
  }

  if (!session?.user) {
    return (
      <div className="w-[30px] h-[30px] rounded-full bg-[var(--accent)] flex items-center justify-center font-code text-[11px] font-semibold text-white">
        ?
      </div>
    );
  }

  const { name, email, image } = session.user;
  const initials = name
    ? name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : (email?.[0] ?? 'U').toUpperCase();

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut({ callbackUrl: '/auth/signin' });
  };

  return (
    <div className="relative">
      <button
        id="user-avatar-btn"
        aria-label={`User menu for ${name ?? email}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => showSignOut && setOpen((v) => !v)}
        className="w-[30px] h-[30px] rounded-full overflow-hidden border-2 border-transparent hover:border-[var(--accent)] transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        {image && !imageError ? (
          
          <Image
            src={image}
            alt={name ?? 'User avatar'}
            width={30}
            height={30}
            unoptimized
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full bg-[var(--accent)] flex items-center justify-center font-code text-[11px] font-semibold text-white">
            {initials}
          </div>
        )}
      </button>

      {}
      {open && (
        <>
          {}
          <div
            className="fixed inset-0 z-40"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            aria-label="User menu"
            className="absolute right-0 top-[38px] z-50 w-[200px] bg-[var(--card)] border border-[var(--border)] rounded-[10px] shadow-xl overflow-hidden animate-[msgIn_.15s_ease-out]"
          >
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <p className="font-body text-[12px] font-medium text-[var(--text)] truncate">{name}</p>
              <p className="font-code text-[10px] text-[var(--muted)] truncate">{email}</p>
            </div>
            <button
              id="sign-out-btn"
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full px-4 py-3 text-left font-code text-[11px] text-[var(--danger)] hover:bg-[var(--surface)] transition-colors duration-100 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {signingOut ? 'Signing out…' : '→ Sign out'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
