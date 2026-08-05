import { render, type RenderOptions } from "@testing-library/react";
import { RefereeAuthProvider } from "@/contexts/RefereeAuthContext";
import type { ReactElement, ReactNode } from "react";

/**
 * Renders `ui` wrapped in `RefereeAuthProvider`, matching the provider tree
 * every characterization test in this repo needs.
 *
 * `RefereeAuthProvider` calls `useRouter()` (from `next/navigation`) and creates a
 * Supabase browser client (`createBrowserSupabaseClient`) on mount, subscribing to
 * auth state changes. This helper does NOT mock either of those — `vi.mock` is
 * per-test-file and hoisted, so it must be set up in the CONSUMING test file, e.g.:
 *
 * ```ts
 * vi.mock("next/navigation");
 * vi.mock("@/lib/supabase/browserClient");
 * ```
 *
 * Add those two `vi.mock` calls (with whatever return values the test needs) at the
 * top of any test file that imports `renderWithProviders`.
 */
function Providers({ children }: { children: ReactNode }) {
  return <RefereeAuthProvider>{children}</RefereeAuthProvider>;
}

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, { wrapper: Providers, ...options });
}
