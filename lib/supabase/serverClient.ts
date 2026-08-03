import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

/**
 * Auth-aware server Supabase client for Server Components and Route Handlers — reads/writes the
 * session from Next.js cookies via @supabase/ssr. Use this (not `client.ts`'s
 * `createServerSupabaseClient`) whenever you need the current user's session, e.g. the referee
 * organizer gate (`lib/auth/organizer.ts`).
 *
 * Server Components cannot set cookies (Next.js restriction) — the `setAll` here is wrapped in a
 * try/catch for that case. `middleware.ts` is responsible for refreshing the session cookie on
 * every request so Server Components always see a fresh session.
 */
export async function createAuthServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component — session refresh is handled by middleware.ts instead.
        }
      },
    },
  });
}
