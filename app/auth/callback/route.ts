import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/serverClient";

const DEFAULT_NEXT = "/admin/referee";

/**
 * Google OAuth callback. Supabase redirects here with a `code` query param after the user
 * consents; we exchange it for a session (sets the auth cookies via `createAuthServerClient`)
 * then redirect to `next` (defaults to the referee page, since that's the only auth-gated screen).
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createAuthServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/admin/referee?auth_error=1`);
}

/** Only allow same-app relative paths — never redirect off-site based on a query param. */
function sanitizeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return DEFAULT_NEXT;
  }
  return next;
}
