import { getOrganizerSession } from "@/lib/auth/organizer";
import { AdminSignedOut } from "./AdminSignedOut";
import { AdminDenied } from "./AdminDenied";
import { AdminNav } from "./AdminNav";

// Fresh session on every request — an organizer's access must always reflect the real current
// allow-list state, never a stale/cached check.
export const dynamic = "force-dynamic";

/**
 * Server-gated: `getOrganizerSession()` reads the Supabase session cookie and calls the DB
 * `is_organizer()` function. Non-organizers (signed out OR signed in but not allow-listed) never
 * receive the admin UI in the server-rendered payload — this is a UX nicety, though. The real
 * boundary is the RLS write policies (organizer-only), which would reject a write from a
 * non-organizer even if this check were somehow bypassed.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isOrganizer } = await getOrganizerSession();

  return (
    <div className="max-w-[1240px] mx-auto px-5 pt-[34px] pb-[60px]">
      {!user && <AdminSignedOut />}
      {user && !isOrganizer && <AdminDenied email={user.email} />}
      {user && isOrganizer && (
        <>
          <AdminNav />
          {children}
        </>
      )}
    </div>
  );
}
