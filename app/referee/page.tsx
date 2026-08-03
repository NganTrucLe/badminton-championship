import { getOrganizerSession } from "@/lib/auth/organizer";
import { RefereeSignedOutPanel } from "./RefereeSignedOutPanel";
import { RefereeDeniedPanel } from "./RefereeDeniedPanel";
import { RefereeScoringPanel } from "./RefereeScoringPanel";

/**
 * Server-gated: `getOrganizerSession()` reads the Supabase session cookie and calls the DB
 * `is_organizer()` function. Non-organizers (signed out OR signed in but not allow-listed) never
 * receive the scoring UI in the server-rendered payload — this is a UX nicety, though. The real
 * boundary is the `matches` RLS write policy (organizer-only UPDATE/INSERT), which would reject a
 * write from a non-organizer even if this check were somehow bypassed.
 */
export default async function RefereePage() {
  const { user, isOrganizer } = await getOrganizerSession();

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "34px 20px 60px" }}>
      {!user && <RefereeSignedOutPanel />}
      {user && !isOrganizer && <RefereeDeniedPanel email={user.email} />}
      {user && isOrganizer && <RefereeScoringPanel />}
    </div>
  );
}
