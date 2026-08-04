import { Suspense } from "react";
import { getAdminPairs, getAdminPlayers } from "@/lib/supabase/admin";
import { getTournament } from "@/lib/supabase/tournament";
import { PairsEditor } from "./PairsEditor";
import { AdminSectionSkeleton } from "../AdminSectionSkeleton";

export const dynamic = "force-dynamic";

async function PairsData() {
  const [pairs, allPlayers, { status }] = await Promise.all([
    getAdminPairs(),
    getAdminPlayers(),
    getTournament(),
  ]);
  return <PairsEditor initialPairs={pairs} players={allPlayers} editable={status === "setup"} />;
}

export default function AdminPairsPage() {
  return (
    <Suspense fallback={<AdminSectionSkeleton title="Cặp đấu" />}>
      <PairsData />
    </Suspense>
  );
}
