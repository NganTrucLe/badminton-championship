export function LivePulse({
  className,
  color = "var(--color-live)",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        animation: "livePulse 1.4s ease-in-out infinite",
      }}
    />
  );
}
