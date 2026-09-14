export function ProgressBar({
  value,
  className = '',
}: {
  value: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-[10px] rounded-full bg-[#e9e6d6] overflow-hidden ${className}`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{
          width: `${pct}%`,
          backgroundImage: 'linear-gradient(90deg, #18181b, #0e6847 60%, #14724f)',
        }}
      />
    </div>
  );
}