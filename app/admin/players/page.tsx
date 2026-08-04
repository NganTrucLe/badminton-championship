import { Suspense } from "react";
import { getAdminPlayers } from "@/lib/supabase/admin";
import { getTournament } from "@/lib/supabase/tournament";
import { PlayersEditor } from "./PlayersEditor";
import { AdminSectionSkeleton } from "../AdminSectionSkeleton";

export const dynamic = "force-dynamic";

async function PlayersData() {
  const [players, { status }] = await Promise.all([getAdminPlayers(), getTournament()]);
  return <PlayersEditor initialPlayers={players} editable={status === "setup"} />;
}

export default function AdminPlayersPage() {
  return (
    <Suspense fallback={<AdminSectionSkeleton title="Vận động viên" />}>
      <PlayersData />
    </Suspense>
  );
}
