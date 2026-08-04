import { Suspense } from "react";
import { getTournament } from "@/lib/supabase/tournament";
import { RewardsEditor } from "./RewardsEditor";
import { AdminSectionSkeleton } from "../AdminSectionSkeleton";

export const dynamic = "force-dynamic";

async function RewardsData() {
  const { rewards } = await getTournament();
  return <RewardsEditor initialRewards={rewards} />;
}

export default function AdminRewardsPage() {
  return (
    <Suspense fallback={<AdminSectionSkeleton title="Phần thưởng" />}>
      <RewardsData />
    </Suspense>
  );
}
