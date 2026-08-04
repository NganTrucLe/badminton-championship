import { getAdminPlayers } from "@/lib/supabase/admin";
import { getTournament } from "@/lib/supabase/tournament";
import { PlayersEditor } from "./PlayersEditor";

export const dynamic = "force-dynamic";

export default async function AdminPlayersPage() {
  const [players, { status }] = await Promise.all([getAdminPlayers(), getTournament()]);
  return <PlayersEditor initialPlayers={players} editable={status === "setup"} />;
}
