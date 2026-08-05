import { Suspense } from "react";
import { getMvpCandidates, getMvpStatus } from "@/lib/supabase/mvp";
import { groupCandidatesByGender } from "@/lib/tournament/mvp";
import { VoteFlow } from "./VoteFlow";
import { Skeleton } from "@/components/Skeleton";

export const dynamic = "force-dynamic";

async function VoteData() {
  const [status, candidates] = await Promise.all([getMvpStatus(), getMvpCandidates()]);
  const { male, female } = groupCandidatesByGender(candidates);
  return <VoteFlow status={status} male={male} female={female} />;
}

export default function VotePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 font-[family-name:var(--font-bricolage)] text-2xl">Bình chọn MVP</h1>
      <Suspense fallback={<Skeleton height="320px" borderRadius="16px" />}>
        <VoteData />
      </Suspense>
    </main>
  );
}
