import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Server-only Supabase client using the anon/publishable key. Public pages are read-only, so this
 * key (safe to expose, but we still keep the client on the server) plus RLS's public SELECT
 * policies are all that's needed here. Never import this from a "use client" component.
 *
 * This client does not track auth session state (`persistSession: false`) — it is for anonymous
 * public reads only. For session-aware reads/writes (referee auth), use
 * `lib/supabase/serverClient.ts` instead.
 */
export function createServerSupabaseClient() {
  return createClient<Database>(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: {
      persistSession: false,
    },
  });
}
