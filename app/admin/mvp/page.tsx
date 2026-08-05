import { Suspense } from "react";
import { AdminSectionSkeleton } from "@/app/admin/AdminSectionSkeleton";
import { getMvpStatus } from "@/lib/supabase/mvp";
import { MvpControlPanel } from "./MvpControlPanel";
import { MvpVoterAllowlistEditor } from "./MvpVoterAllowlistEditor";

export const dynamic = "force-dynamic";

async function MvpAdminData() {
  const status = await getMvpStatus();
  return (
    <div className="flex flex-col gap-6">
      <MvpControlPanel initial={status} />
      <MvpVoterAllowlistEditor disabled={status.status === "open"} />
    </div>
  );
}

export default function MvpAdminPage() {
  return (
    <Suspense fallback={<AdminSectionSkeleton title="Bình chọn MVP" />}>
      <MvpAdminData />
    </Suspense>
  );
}
