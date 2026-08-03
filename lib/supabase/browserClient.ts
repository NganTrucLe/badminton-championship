import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Browser Supabase client for the referee auth flow (Google OAuth sign-in/out, session state).
 * Only import this from "use client" components. Public read paths continue to use the
 * server-only client in `client.ts` — this one exists solely for auth.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(getSupabaseUrl(), getSupabasePublishableKey());
}
