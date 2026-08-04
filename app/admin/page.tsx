import { Suspense } from "react";
import { getTournament } from "@/lib/supabase/tournament";
import { getAdminPairs, getAdminPlayers } from "@/lib/supabase/admin";
import { validateRosterComplete } from "@/lib/tournament/adminValidation";
import { LifecyclePanel } from "./LifecyclePanel";
import { RewardsEditor } from "./RewardsEditor";
import { AdminSectionSkeleton } from "./AdminSectionSkeleton";

export const dynamic = "force-dynamic";

async function OverviewData() {
  const { status, rewards } = await getTournament();
  const [pairs, players] = await Promise.all([getAdminPairs(), getAdminPlayers()]);
  const rosterError = validateRosterComplete(
    pairs.map((p) => ({ player1Id: p.player1Id, player2Id: p.player2Id })),
    players.length,
  );
  return (
    <>
      <LifecyclePanel initialStatus={status} rosterError={rosterError} />
      <section style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid rgba(10,31,26,.1)" }}>
        <RewardsEditor initialRewards={rewards} />
      </section>
    </>
  );
}

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<AdminSectionSkeleton title="Điều khiển giải đấu" />}>
      <OverviewData />
    </Suspense>
  );
}
