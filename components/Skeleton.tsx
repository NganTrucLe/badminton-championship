import { CSSProperties } from "react";

/**
 * A lightweight pulsing skeleton block for loading states.
 * CSS-only pulse animation — no Date.now() or Math.random().
 */
export function Skeleton({
  width = "100%",
  height = "20px",
  borderRadius = "4px",
  className,
  style,
  ...rest
}: {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
  style?: CSSProperties;
  [key: string]: unknown;
}) {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius,
        background: "#FFFDF7",
        border: "1px solid rgba(10,31,26,.08)",
        animation: "skeletonPulse 2s ease-in-out infinite",
        ...style,
      }}
      {...rest}
    />
  );
}
