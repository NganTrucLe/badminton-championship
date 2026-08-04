import { getTournament } from "@/lib/supabase/tournament";
import { LifecyclePanel } from "./LifecyclePanel";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const { status } = await getTournament();
  return <LifecyclePanel initialStatus={status} />;
}
