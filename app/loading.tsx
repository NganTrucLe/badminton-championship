import { Skeleton } from "@/components/Skeleton";

/**
 * Loading skeleton for the home page.
 * Shows a hero block placeholder and cards below matching the live section and location card layout.
 */
export default function HomeLoading() {
  return (
    <div>
      {/* Hero skeleton */}
      <div style={{ maxWidth: 1240, margin: "22px auto 0", padding: "0 20px" }}>
        <div
          style={{
            borderRadius: 26,
            overflow: "hidden",
            background: "#F4F1E6",
            padding: "clamp(30px,5vw,64px)",
            minHeight: "clamp(430px,60vw,560px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <div>
            <Skeleton width="180px" height="32px" borderRadius="999px" />
            <Skeleton width="320px" height="56px" borderRadius="12px" style={{ marginTop: 20 }} />
            <Skeleton width="440px" height="48px" borderRadius="8px" style={{ marginTop: 20 }} />
          </div>
          <div>
            <Skeleton width="280px" height="24px" borderRadius="8px" />
            <Skeleton width="320px" height="32px" borderRadius="8px" style={{ marginTop: 14 }} />
          </div>
        </div>
      </div>

      {/* Cards skeleton */}
      <div
        style={{
          maxWidth: 1240,
          margin: "16px auto 0",
          padding: "0 20px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
          gap: 16,
        }}
      >
        {/* Live section card */}
        <div style={{ background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 22, padding: 26 }}>
          <Skeleton width="140px" height="20px" borderRadius="4px" />
          <Skeleton width="240px" height="32px" borderRadius="8px" style={{ marginTop: 14 }} />
          <Skeleton width="320px" height="48px" borderRadius="8px" style={{ marginTop: 14 }} />
        </div>

        {/* Location card */}
        <div style={{ background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 22, padding: 26 }}>
          <Skeleton width="140px" height="20px" borderRadius="4px" />
          <Skeleton width="200px" height="32px" borderRadius="8px" style={{ marginTop: 14 }} />
          <Skeleton width="320px" height="40px" borderRadius="8px" style={{ marginTop: 14 }} />
          <Skeleton width="100%" height="130px" borderRadius="14px" style={{ marginTop: 16 }} />
          <Skeleton width="140px" height="36px" borderRadius="999px" style={{ marginTop: 14 }} />
        </div>
      </div>

      {/* Rewards section skeleton */}
      <div style={{ maxWidth: 1240, margin: "16px auto 0", padding: "0 20px" }}>
        <Skeleton width="200px" height="36px" borderRadius="8px" style={{ marginBottom: 14 }} />
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            gap: 16,
            flexWrap: "wrap",
            padding: "20px 0 8px",
          }}
        >
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: 220 }}>
              <Skeleton width="76px" height="76px" borderRadius="50%" />
              <Skeleton width="200px" height="24px" borderRadius="8px" />
              <Skeleton width="100%" height="150px" borderRadius="14px" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
