/**
 * Instant-paint fallback shown while an admin page's data-dependent section streams in.
 * Mirrors the editor heading style so the title stays stable across the Suspense swap,
 * plus a handful of pulsing rows that echo the editors' row cards.
 */
export function AdminSectionSkeleton({ title }: { title: string }) {
  return (
    <div>
      <h2
        style={{
          fontFamily: "var(--font-bricolage), sans-serif",
          fontSize: 28,
          fontWeight: 900,
          margin: "0 0 16px",
        }}
      >
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 64,
              borderRadius: 14,
              background: "#FFFDF7",
              border: "1px solid rgba(10,31,26,.08)",
              animation: "skeletonPulse 2s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    </div>
  );
}
