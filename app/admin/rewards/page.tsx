import { getTournament } from "@/lib/supabase/tournament";
import { RewardsEditor } from "./RewardsEditor";

export const dynamic = "force-dynamic";

export default async function AdminRewardsPage() {
  const { rewards } = await getTournament();
  return <RewardsEditor initialRewards={rewards} />;
}
