import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { DemoChat } from '@/features/demo/components/demo-chat';

export const metadata = {
  title: 'Demo | CodeSentinel',
  description: 'Ask questions about a pre-indexed repository — no sign-in required.',
};

export const dynamic = 'force-dynamic';

export default async function DemoPage() {
  if (env.demo.repoIds.length === 0) {
    notFound();
  }

  const repo = await db.repository.findFirst({
    where: { id: { in: env.demo.repoIds } },
    orderBy: { name: 'asc' },
    select: {
      owner: true,
      name: true,
      description: true,
      language: true,
      file_count: true,
      commit_sha: true,
      _count: { select: { graph_nodes: true } },
    },
  });

  if (!repo || repo._count.graph_nodes === 0) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex w-full max-w-[900px] items-center gap-3 px-5 py-4">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-zinc-900 text-[13px] font-bold text-white">
            C
          </span>
          <span className="text-[15px] font-semibold tracking-tight">CodeSentinel</span>
          <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-zinc-500">
            Demo
          </span>
          <Link
            href="/auth/signin"
            className="ml-auto rounded-full bg-zinc-900 px-4 py-2 text-[12px] font-medium text-white"
          >
            Connect your own repo
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[900px] px-5 py-8">
        <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">
          Pre-indexed repository
        </p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight">
          {repo.owner}/{repo.name}
        </h1>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-zinc-500">
          {repo.description || 'Ask questions below — answers are grounded in indexed source evidence.'}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
          {repo.language && <span>{repo.language}</span>}
          <span>{repo.file_count.toLocaleString()} files</span>
          <span>{repo._count.graph_nodes.toLocaleString()} symbols indexed</span>
          {repo.commit_sha && <span className="font-mono">{repo.commit_sha.slice(0, 7)}</span>}
        </div>

        <div className="mt-6">
          <DemoChat />
        </div>

        <p className="mt-8 border-t border-zinc-200 pt-4 text-[11px] leading-relaxed text-zinc-400">
          Demo data — {repo.file_count.toLocaleString()} files pre-indexed. Connect GitHub to
          index your own private repositories (read-only, your code is never modified).
        </p>
      </main>
    </div>
  );
}
