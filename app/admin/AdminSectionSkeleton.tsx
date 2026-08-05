import { Skeleton } from "@/components/Skeleton";

/**
 * Instant-paint fallback shown while an admin page's data-dependent section streams in.
 * Mirrors the editor heading style so the title stays stable across the Suspense swap,
 * plus a handful of pulsing rows that echo the editors' row cards.
 */
export function AdminSectionSkeleton({ title }: { title: string }) {
  return (
    <div>
      <h2 className="m-0 mb-4 font-[family-name:var(--font-bricolage)] text-[28px] font-black">
        {title}
      </h2>
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height="64px" borderRadius="14px" />
        ))}
      </div>
    </div>
  );
}
