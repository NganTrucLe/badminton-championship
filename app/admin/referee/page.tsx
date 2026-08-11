import { Suspense } from "react";
import { getMatches, getPairIdToTeamId, getTeams, getTournament } from "@/lib/supabase/tournament";
import { AdminSectionSkeleton } from "../AdminSectionSkeleton";
import { ensureNextRound } from "./ensureNextRound";
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
  // Self-heal a missed generation when an organizer opens the page; idempotent
  // no-op when nothing is due.
  await ensureNextRound();
  const [matches, pairIdToTeamId, teams] = await Promise.all([getMatches(), getPairIdToTeamId(), getTeams()]);
  return <RefereeScoringPanel initialMatches={matches} pairIdToTeamId={pairIdToTeamId} teams={teams} />;
}
