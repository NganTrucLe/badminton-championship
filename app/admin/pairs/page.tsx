import { getAdminPairs, getAdminPlayers } from "@/lib/supabase/admin";
import { getTournament } from "@/lib/supabase/tournament";
import { PairsEditor } from "./PairsEditor";

export const dynamic = "force-dynamic";

export default async function AdminPairsPage() {
  const [pairs, allPlayers, { status }] = await Promise.all([
    getAdminPairs(),
    getAdminPlayers(),
    getTournament(),
  ]);
  return <PairsEditor initialPairs={pairs} players={allPlayers} editable={status === "setup"} />;
}
