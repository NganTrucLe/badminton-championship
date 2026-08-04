import { Suspense } from "react";
import { getMatches, getPairIdToTeamId } from "@/lib/supabase/tournament";
import { RefereeScoringPanel } from "./RefereeScoringPanel";
import { AdminSectionSkeleton } from "../AdminSectionSkeleton";

// Fresh matches on every request — a referee must always start from the real current scores,
// never a stale/mocked list.
export const dynamic = "force-dynamic";

async function RefereeData() {
  const [matches, pairIdToTeamId] = await Promise.all([getMatches(), getPairIdToTeamId()]);
  return <RefereeScoringPanel initialMatches={matches} pairIdToTeamId={pairIdToTeamId} />;
}

export default function AdminRefereePage() {
  return (
    <Suspense fallback={<AdminSectionSkeleton title="Cập nhật tỉ số" />}>
      <RefereeData />
    </Suspense>
  );
}
