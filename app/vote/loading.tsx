import { Skeleton } from "@/components/Skeleton";

export default function VoteLoading() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Skeleton width="220px" height="32px" borderRadius="8px" className="mb-6" />
      <Skeleton height="320px" borderRadius="16px" />
    </main>
  );
}
