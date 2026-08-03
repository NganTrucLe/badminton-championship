"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";

interface IRefereeAuthContextValue {
  /** Current Supabase session user, or null if signed out. Loaded asynchronously on mount. */
  user: User | null;
  /** True until the initial session check resolves. */
  loading: boolean;
  /**
   * Starts the Google OAuth flow (full-page redirect to Google, then back to `/auth/callback`,
   * which exchanges the code for a session and redirects to `next`).
   *
   * NOTE: this only proves *who* the caller is — it does NOT grant referee access. Organizer
   * status is checked server-side via `lib/auth/organizer.ts` (which calls the DB's
   * `is_organizer()` function) and enforced for real by the `matches` RLS write policies.
   */
  signInWithGoogle: (next?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const RefereeAuthContext = createContext<IRefereeAuthContextValue | undefined>(undefined);

/**
 * Real Supabase Google OAuth session state (Phase 3). Replaces the Phase 1 mock boolean —
 * `signedIn` is no longer a client-only flag; it mirrors the actual Supabase auth session, which
 * the server independently re-checks (via `lib/auth/organizer.ts`) before ever rendering the
 * referee scoring UI.
 */
export function RefereeAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUser(data.user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo<IRefereeAuthContextValue>(
    () => ({
      user,
      loading,
      signInWithGoogle: async (next = "/referee") => {
        const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo },
        });
        if (error) {
          throw new Error(`Google sign-in failed: ${error.message}`);
        }
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw new Error(`Sign-out failed: ${error.message}`);
        }
        router.replace("/");
        router.refresh();
      },
    }),
    [user, loading, supabase, router],
  );

  return <RefereeAuthContext.Provider value={value}>{children}</RefereeAuthContext.Provider>;
}

export function useRefereeAuth(): IRefereeAuthContextValue {
  const ctx = useContext(RefereeAuthContext);
  if (!ctx) {
    throw new Error("useRefereeAuth must be used within a RefereeAuthProvider");
  }
  return ctx;
}
