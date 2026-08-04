import "server-only";
import { createAuthServerClient } from "@/lib/supabase/serverClient";

export interface IOrganizerSessionUser {
  id: string;
  email: string | null;
}

export interface IOrganizerSession {
  user: IOrganizerSessionUser | null;
  /**
   * True only when the signed-in user's email is in the DB `organizers` allow-list, per the
   * `is_organizer()` SECURITY DEFINER SQL function (see supabase/migrations). This is the real
   * security boundary — the `matches` RLS write policies check the same function server-side, so
   * even if this check were bypassed in the UI, a non-organizer's write would still be rejected
   * by Postgres. This helper only exists to render the correct UI state.
   */
  isOrganizer: boolean;
}

/**
 * Reads the current session (if any) and, when signed in, calls the `is_organizer()` RPC to
 * determine organizer status. Used to gate `/admin` (including `/admin/referee`):
 * signed-out and signed-in-but-not-organizer both render a denied/signed-out panel; only
 * organizers see the admin UI.
 */
export async function getOrganizerSession(): Promise<IOrganizerSession> {
  const supabase = await createAuthServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, isOrganizer: false };
  }

  const { data, error } = await supabase.rpc("is_organizer");
  if (error) {
    throw new Error(`Failed to check organizer status: ${error.message}`);
  }

  return {
    user: { id: user.id, email: user.email ?? null },
    isOrganizer: data === true,
  };
}
