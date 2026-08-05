import { CSSProperties } from "react";
import { Skeleton as UiSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * A lightweight pulsing skeleton block for loading states.
 * Backed by the shadcn Skeleton primitive (animate-pulse), styled to
 * preserve this app's established cream skeleton look.
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
    <UiSkeleton
      className={cn("bg-transparent", className)}
      style={{
        width,
        height,
        borderRadius,
        background: "var(--color-cream)",
        border: "1px solid rgba(10,31,26,.08)",
        ...style,
      }}
      {...rest}
    />
  );
}
