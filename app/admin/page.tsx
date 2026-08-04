import { Suspense } from "react";
import { getTournament } from "@/lib/supabase/tournament";
import { getAdminPairs, getAdminPlayers } from "@/lib/supabase/admin";
import { validateRosterComplete } from "@/lib/tournament/adminValidation";
import { LifecyclePanel } from "./LifecyclePanel";
import { AdminSectionSkeleton } from "./AdminSectionSkeleton";

export const dynamic = "force-dynamic";

async function OverviewData() {
  const { status } = await getTournament();
  const [pairs, players] = await Promise.all([getAdminPairs(), getAdminPlayers()]);
  const rosterError = validateRosterComplete(
    pairs.map((p) => ({ player1Id: p.player1Id, player2Id: p.player2Id })),
    players.length,
  );
  return <LifecyclePanel initialStatus={status} rosterError={rosterError} />;
}

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<AdminSectionSkeleton title="Điều khiển giải đấu" />}>
      <OverviewData />
    </Suspense>
  );
}
