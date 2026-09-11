import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import Link from 'next/link';
import { RepositoryChatUI } from '@/features/chat/components/repository-chat-ui';

export const metadata = {
  title: 'Repository Chat | CodeSentinel',
};

export default async function RepositoryChatPage(props: { params: Promise<{ repoId: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const { repoId } = params;

  const repo = await db.repository.findUnique({
    where: {
      id: repoId,
      user_id: session.user.id,
    }
  });

  if (!repo) {
    redirect('/dashboard/repos');
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--bg)]">
      {/* Tab Navigation */}
      <header className="border-b border-[var(--border)] bg-[var(--card)] px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard/repos" className="text-[var(--muted)] hover:text-[var(--text)] text-sm transition shrink-0">
            ← Repos
          </Link>
          <span className="text-[var(--border)]">/</span>
          <h1 className="font-semibold text-sm text-[var(--text)] truncate">
            {repo.owner}/{repo.name}
          </h1>
        </div>

        <nav className="flex items-center gap-1 bg-[var(--surface)] rounded-lg p-1 shrink-0">
          <Link
            href={`/dashboard/repos/${repoId}/wiki`}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--card)] transition flex items-center gap-1.5"
          >
            📖 Wiki
          </Link>
          <span className="px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--card)] text-[var(--text)] shadow-sm flex items-center gap-1.5 border border-[var(--border)]">
            💬 Chat
          </span>
        </nav>
      </header>

      <div className="flex-1 overflow-hidden">
        <RepositoryChatUI repoId={repo.id} />
      </div>
    </div>
  );
}

