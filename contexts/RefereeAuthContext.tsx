"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface IRefereeAuthContextValue {
  signedIn: boolean;
  signIn: () => void;
  signOut: () => void;
}

const RefereeAuthContext = createContext<IRefereeAuthContextValue | undefined>(undefined);

/**
 * TODO(Phase 3/4): replace with real Supabase Google OAuth + organizer allow-list check.
 * For Phase 1 this is purely local client state — the "Đăng nhập Google" button is a no-op
 * placeholder that just flips a boolean, matching the design's demo-only auth ("DEMO · KHÔNG
 * XÁC THỰC THẬT"). Resets on page reload; nothing is persisted or verified server-side.
 */
export function RefereeAuthProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);

  const value = useMemo(
    () => ({
      signedIn,
      signIn: () => setSignedIn(true),
      signOut: () => setSignedIn(false),
    }),
    [signedIn],
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
