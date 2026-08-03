/**
 * Shared env var readers for every Supabase client (read-only server client, auth-aware server
 * client, browser client, middleware). Not "server-only" — only `NEXT_PUBLIC_*` vars, which are
 * safe to read on the client too.
 */

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL env var");
  }
  return url;
}

/**
 * Prefers the new-style publishable key (what the cloud project issues); falls back to the
 * legacy anon key name for local dev (`supabase start` still prints "ANON_KEY").
 */
export function getSupabasePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) env var",
    );
  }
  return key;
}
