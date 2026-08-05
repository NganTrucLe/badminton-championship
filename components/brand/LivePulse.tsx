export function LivePulse({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "var(--color-live)",
        animation: "livePulse 1.4s ease-in-out infinite",
      }}
    />
  );
}
