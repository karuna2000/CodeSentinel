export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-4">
        <div className="h-8 w-48 rounded bg-[var(--border)]/60 animate-pulse" />
        <div className="h-5 w-72 rounded bg-[var(--border)]/60 animate-pulse" />
        <div className="grid gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-[var(--border)]/60 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}