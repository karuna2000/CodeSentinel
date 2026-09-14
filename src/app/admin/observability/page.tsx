import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export const metadata = {
  title: 'Observability | CodeSentinel',
  description: 'Traces, guardrail evals, and LLM cost for your workspace.',
};

export const dynamic = 'force-dynamic';

// NOTE (security): this page has no admin role — every query below MUST stay
// scoped to the session user_id. Any future query added here must filter by
// user_id, or it becomes a cross-user data leak behind an "admin" URL.

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{ event?: string }>;
}

function formatTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default async function ObservabilityPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/admin/observability');
  }
  const userId = session.user.id;
  const { event: eventFilter } = await searchParams;

  // Server component runs once per request; the 24h window is request-scoped.
  // eslint-disable-next-line react-hooks/purity
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);

  const [eventCount, chatCount, blockedCount, usageRows, recentEvents, recentChats, eventNames] =
    await Promise.all([
      db.traceEvent.count({ where: { user_id: userId, created_at: { gte: dayAgo } } }),
      db.chatHistory.count({ where: { user_id: userId } }),
      db.chatHistory.count({ where: { user_id: userId, blocked: true } }),
      db.llmUsage.findMany({
        where: { user_id: userId, created_at: { gte: dayAgo } },
        select: { feature: true, input_tokens: true, output_tokens: true },
      }),
      db.traceEvent.findMany({
        where: {
          user_id: userId,
          ...(eventFilter ? { name: eventFilter } : {}),
        },
        orderBy: { created_at: 'desc' },
        take: PAGE_SIZE,
        select: { id: true, name: true, metadata: true, repo_id: true, created_at: true },
      }),
      db.chatHistory.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: PAGE_SIZE,
        select: {
          id: true,
          query: true,
          intent: true,
          status: true,
          blocked: true,
          evals: true,
          latency_ms: true,
          created_at: true,
        },
      }),
      db.traceEvent.groupBy({
        by: ['name'],
        where: { user_id: userId },
        _count: { name: true },
        orderBy: { _count: { name: 'desc' } },
        take: 20,
      }),
    ]);

  const tokensByFeature = new Map<string, number>();
  for (const row of usageRows) {
    tokensByFeature.set(
      row.feature,
      (tokensByFeature.get(row.feature) ?? 0) + row.input_tokens + row.output_tokens,
    );
  }
  const tokensTotal = [...tokensByFeature.values()].reduce((a, b) => a + b, 0);
  const blockedRate = chatCount > 0 ? Math.round((blockedCount / chatCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-white px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">
              Admin
            </p>
            <h1 className="mt-1 text-[22px] font-semibold tracking-tight">Observability</h1>
            <p className="mt-1 text-[13px] text-zinc-500">
              Last 24 hours for usage and cost; recent events and chats below. Scoped to your
              account.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 rounded-full border border-zinc-200 px-4 py-2 text-[12px] font-medium hover:border-zinc-400"
          >
            Back to workspace
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Metric value={eventCount.toLocaleString()} label="Events (24h)" />
          <Metric value={chatCount.toLocaleString()} label="Chats (all time)" />
          <Metric value={`${blockedRate}%`} label="Blocked rate" />
          <Metric value={tokensTotal.toLocaleString()} label="Tokens (24h)" />
          <Metric value={tokensByFeature.size.toString()} label="Active features" />
        </div>

        <section className="mt-6 rounded-2xl border border-zinc-200 p-5">
          <h2 className="text-[14px] font-semibold">Tokens by feature (24h)</h2>
          {tokensByFeature.size === 0 ? (
            <EmptyState text="No LLM usage recorded in the last 24 hours." />
          ) : (
            <dl className="mt-3 space-y-2">
              {[...tokensByFeature.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([feature, tokens]) => (
                  <div key={feature} className="flex items-center gap-3 text-[12px]">
                    <dt className="w-36 shrink-0 font-mono text-zinc-600">{feature}</dt>
                    <dd className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <span
                        className="block h-full rounded-full bg-zinc-900"
                        style={{ width: `${Math.max(2, Math.round((tokens / tokensTotal) * 100))}%` }}
                      />
                    </dd>
                    <dd className="w-24 shrink-0 text-right tabular-nums text-zinc-600">
                      {tokens.toLocaleString()}
                    </dd>
                  </div>
                ))}
            </dl>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[14px] font-semibold">Recent events</h2>
            <form method="get" className="flex items-center gap-2">
              <select
                name="event"
                defaultValue={eventFilter ?? ''}
                className="h-8 rounded-full border border-zinc-200 bg-white px-3 text-[12px] outline-none"
              >
                <option value="">All event types</option>
                {eventNames.map((e) => (
                  <option key={e.name} value={e.name}>
                    {e.name} ({e._count.name})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-8 rounded-full bg-zinc-900 px-4 text-[12px] font-medium text-white"
              >
                Filter
              </button>
            </form>
          </div>
          {recentEvents.length === 0 ? (
            <EmptyState text="No events yet. Use chat, generate a wiki, or manage repos and they will appear here." />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-zinc-200 text-[11px] uppercase tracking-wide text-zinc-500">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Event</th>
                    <th className="py-2 pr-3">Repo</th>
                    <th className="py-2">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map((e) => (
                    <tr key={e.id} className="border-b border-zinc-100 align-top">
                      <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-zinc-500">
                        {formatTime(e.created_at)}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 font-mono">{e.name}</td>
                      <td className="max-w-40 truncate py-2 pr-3 font-mono text-zinc-500">
                        {e.repo_id ? e.repo_id.slice(0, 8) : '—'}
                      </td>
                      <td className="max-w-md truncate py-2 font-mono text-[11px] text-zinc-500">
                        {JSON.stringify(e.metadata)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-200 p-5">
          <h2 className="text-[14px] font-semibold">Recent chats + guardrail verdicts</h2>
          {recentChats.length === 0 ? (
            <EmptyState text="No chats recorded yet." />
          ) : (
            <div className="mt-3 space-y-2">
              {recentChats.map((c) => {
                const evals = c.evals as {
                  gates?: Array<{ gate: string; pass: boolean; detail: string }>;
                  judge?: { pass: boolean; reason: string; judged: boolean };
                  blocked?: boolean;
                } | null;
                return (
                  <div key={c.id} className="rounded-xl border border-zinc-200 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="text-zinc-400">{formatTime(c.created_at)}</span>
                      {c.intent && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium">
                          {c.intent}
                        </span>
                      )}
                      {c.status && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5">{c.status}</span>
                      )}
                      {c.blocked ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">
                          blocked
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                          served
                        </span>
                      )}
                      {c.latency_ms != null && (
                        <span className="ml-auto tabular-nums text-zinc-400">
                          {(c.latency_ms / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-[12.5px] font-medium">{c.query}</p>
                    {evals?.gates && (
                      <p className="mt-1 font-mono text-[11px] text-zinc-500">
                        {evals.gates.map((g) => `${g.gate}:${g.pass ? 'PASS' : 'FAIL'}`).join(' · ')}
                        {evals.judge?.judged &&
                          ` · judge:${evals.judge.pass ? 'PASS' : 'FAIL'} (${evals.judge.reason})`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-4">
      <p className="text-[21px] font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-widest text-zinc-500">
        {label}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="mt-3 text-[12px] leading-relaxed text-zinc-500">{text}</p>;
}
