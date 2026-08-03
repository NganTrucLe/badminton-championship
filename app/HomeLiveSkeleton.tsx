import { Skeleton } from "@/components/Skeleton";

/**
 * Skeleton placeholder for HomeLiveSection.
 * Matches the shape and dimensions of the live match card (dark) and recent results card (light).
 * No layout shift — same border-radius, padding, and grid footprint as the real component.
 */
export function HomeLiveSkeleton() {
  return (
    <>
      {/* Dark live match card skeleton */}
      <div
        style={{
          gridColumn: "span 1",
          background: "#0A1F1A",
          borderRadius: 22,
          padding: 26,
          color: "#FFFDF7",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Header with label + info */}
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "rgba(255,255,255,.15)",
              flex: "none",
            }}
          />
          <div
            style={{
              width: 140,
              height: 13,
              borderRadius: 4,
              background: "rgba(255,255,255,.1)",
              animation: "skeletonPulse 2s ease-in-out infinite",
            }}
          />
          <div
            style={{
              marginLeft: "auto",
              width: 80,
              height: 13,
              borderRadius: 4,
              background: "rgba(255,255,255,.1)",
              animation: "skeletonPulse 2s ease-in-out infinite",
            }}
          />
        </div>

        {/* Score section */}
        <div
          style={{
            marginTop: 22,
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div>
            <div
              style={{
                width: 100,
                height: 12,
                borderRadius: 4,
                background: "rgba(255,255,255,.1)",
                animation: "skeletonPulse 2s ease-in-out infinite",
                marginBottom: 8,
              }}
            />
            <div
              style={{
                width: 140,
                height: 18,
                borderRadius: 4,
                background: "rgba(255,255,255,.1)",
                animation: "skeletonPulse 2s ease-in-out infinite",
                marginTop: 5,
              }}
            />
          </div>
          <div
            style={{
              width: 80,
              height: 48,
              borderRadius: 4,
              background: "rgba(255,255,255,.1)",
              animation: "skeletonPulse 2s ease-in-out infinite",
            }}
          />
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                width: 100,
                height: 12,
                borderRadius: 4,
                background: "rgba(255,255,255,.1)",
                animation: "skeletonPulse 2s ease-in-out infinite",
                marginBottom: 8,
                marginLeft: "auto",
              }}
            />
            <div
              style={{
                width: 140,
                height: 18,
                borderRadius: 4,
                background: "rgba(255,255,255,.1)",
                animation: "skeletonPulse 2s ease-in-out infinite",
                marginTop: 5,
                marginLeft: "auto",
              }}
            />
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            marginTop: 22,
            height: 5,
            borderRadius: 999,
            background: "rgba(255,255,255,.12)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              background: "rgba(255,255,255,.08)",
              borderRadius: 999,
              width: "45%",
            }}
          />
        </div>

        {/* Footer text */}
        <div
          style={{
            marginTop: 10,
            width: 160,
            height: 11,
            borderRadius: 4,
            background: "rgba(255,255,255,.1)",
            animation: "skeletonPulse 2s ease-in-out infinite",
          }}
        />
      </div>

      {/* Light recent results card skeleton */}
      <div style={{ background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 22, padding: 26 }}>
        {/* Header */}
        <Skeleton width="140px" height="12px" borderRadius="4px" />

        {/* Results list placeholders */}
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 2 }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 0",
                borderBottom: "1px solid rgba(10,31,26,.08)",
              }}
            >
              <Skeleton width="26px" height="14px" borderRadius="4px" style={{ flex: "none" }} />
              <Skeleton width="120px" height="14px" borderRadius="4px" style={{ flex: 1, minWidth: 0 }} />
              <Skeleton width="40px" height="14px" borderRadius="4px" style={{ flex: "none" }} />
              <Skeleton width="120px" height="14px" borderRadius="4px" style={{ flex: 1, minWidth: 0 }} />
            </div>
          ))}
        </div>

        {/* Link skeleton */}
        <Skeleton width="180px" height="13px" borderRadius="4px" style={{ marginTop: 16 }} />
      </div>
    </>
  );
}
