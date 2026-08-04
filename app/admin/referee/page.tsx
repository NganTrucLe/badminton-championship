import { Suspense } from "react";
import { getMatches, getPairIdToTeamId, getTournament } from "@/lib/supabase/tournament";
import { AdminSectionSkeleton } from "../AdminSectionSkeleton";
import { RefereeScoringPanel } from "./RefereeScoringPanel";
import { RefereeNotLivePanel } from "./RefereeNotLivePanel";

export const dynamic = "force-dynamic";

export default function AdminRefereePage() {
  return (
    <Suspense fallback={<AdminSectionSkeleton title="Cập nhật tỉ số" />}>
      <RefereeData />
    </Suspense>
  );
}

async function RefereeData() {
  const { status } = await getTournament();
  if (status !== "live") {
    return <RefereeNotLivePanel status={status} />;
  }
  const [matches, pairIdToTeamId] = await Promise.all([getMatches(), getPairIdToTeamId()]);
  return <RefereeScoringPanel initialMatches={matches} pairIdToTeamId={pairIdToTeamId} />;
}
