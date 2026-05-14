export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      className={`inline-block rounded animate-pulse-dark ${className ?? ""}`}
      style={{ background: "var(--border)" }}
    />
  );
}
