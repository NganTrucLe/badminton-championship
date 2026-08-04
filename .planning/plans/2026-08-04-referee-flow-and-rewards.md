# Referee Flow & Rewards-in-Overview Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **This is Plan 1 of 2.** It ships the small, self-contained UI/flow changes. The Swiss auto-pairing engine + Swiss-tree match picker are **Plan 2** (`.planning/plans/2026-08-04-swiss-auto-pairing.md`) and are intentionally NOT here.

**Goal:** Move reward editing into the admin overview, strip meaningless match codes/times from every display, and turn the referee scoring screen into a clean state machine (score only when the tournament is live; one live match at a time; a single Start **or** End action; a confirm-gated per-match reset).

**Architecture:** Pure UI/flow changes on top of the existing Next.js 16 + Supabase app. No schema changes, no new Swiss logic. Reuses the existing `RewardsEditor`, the existing per-match RLS write policy (organizer + tournament status `live`), and `useLiveMatches` realtime. A new single-match "reset to next" write reuses the same `matches` UPDATE policy.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Supabase (Postgres/RLS/Realtime), Vitest + Testing Library.

## Global Constraints

- Do NOT modify `lib/tournament/standings.ts` (18 tests depend on it) except the ONE display-string change in Task 2 (drop the time from `matchDisplay.meta`), which has no test coverage — verify the 18 tests still pass after.
- No schema/migration changes in this plan. Match `code` and `time_label` stay in the DB as internal identifiers; only their **display** is removed.
- The referee scoring screen lives at `app/admin/referee/` (moved there in a prior change); its scoring/RLS write logic (`commit`, `commitLive`, `bump`, the `.select()` + `data.length === 0` guard) must keep working — you are changing which controls show and when, not how a write is authorized.
- Scoring is DB-gated to tournament status `live` already; the referee UI must reflect that (no scoring UI when not live).
- Vietnamese copy. Match the existing inline-style visual language (`#0A1F1A`, `#0B5D4E`, `#F2B544`, `#FFFDF7`, `#B0435F` for danger; fonts `var(--font-archivo)`, `var(--font-bricolage)`, `var(--font-jetbrains)`).
- `npm run build` (against local Supabase), `npm run lint`, and `npm run test` must pass before every commit. Build against local to avoid a cloud-dependency false failure:
  ```
  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local ANON key from `supabase status -o env`> \
  npm run build
  ```
- Atomic commits, title only, scope `admin`: `type(scope): what changed`.

---

## File Structure

- `app/admin/page.tsx` — overview; gains a "Phần thưởng" section below the lifecycle panel (Task 1).
- `app/admin/AdminNav.tsx` — remove the "Phần thưởng" tab (Task 1).
- `app/admin/rewards/` — route deleted; its `RewardsEditor.tsx` moves to `app/admin/RewardsEditor.tsx` (Task 1).
- `lib/tournament/standings.ts` — `matchDisplay.meta` drops the time (Task 2).
- `app/schedule/ScheduleBoard.tsx` — drop round-time + playoff placeholder times (Task 2).
- `app/HomeLiveSection.tsx` — drop the match-code column in recent results (Task 2).
- `app/admin/referee/page.tsx` — gate the scoring UI on tournament status `live` (Task 3).
- `app/admin/referee/RefereeNotLivePanel.tsx` — new "giải chưa bắt đầu" panel (Task 3).
- `app/admin/referee/RefereeScoringPanel.tsx` — state-machine controls: single Start/End, lock-to-live-match, per-match reset (Task 4).

---

### Task 1: Move reward editing into "Tổng quan"

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `app/admin/AdminNav.tsx:6-11`
- Move: `app/admin/rewards/RewardsEditor.tsx` → `app/admin/RewardsEditor.tsx`
- Delete: `app/admin/rewards/page.tsx`, `app/admin/rewards/RewardsEditor.tsx` (after move)

**Interfaces:**
- Consumes: `getTournament()` → `{ status, rewards }` (already used by the overview), `RewardsEditor({ initialRewards })` (existing, unchanged component logic).
- Produces: overview page renders `<LifecyclePanel/>` then a visually separated `<RewardsEditor/>` section.

- [ ] **Step 1: Move the editor component**

```bash
git mv app/admin/rewards/RewardsEditor.tsx app/admin/RewardsEditor.tsx
```
The component body is unchanged. Its import `@/lib/tournament/reward` is absolute, so it still resolves. (Do not edit its internals.)

- [ ] **Step 2: Render rewards as a separate section in the overview**

Rewrite `app/admin/page.tsx` so the async data child fetches rewards too and renders both panels, with the rewards block visually separated (its own card/heading). Keep the Suspense shell from the prior streaming change.

```tsx
import { getTournament } from "@/lib/supabase/tournament";
import { getAdminPairs, getAdminPlayers } from "@/lib/supabase/admin";
import { validateRosterComplete } from "@/lib/tournament/adminValidation";
import { Suspense } from "react";
import { LifecyclePanel } from "./LifecyclePanel";
import { RewardsEditor } from "./RewardsEditor";
import { AdminSectionSkeleton } from "./AdminSectionSkeleton";

export const dynamic = "force-dynamic";

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<AdminSectionSkeleton title="Điều khiển giải đấu" />}>
      <OverviewData />
    </Suspense>
  );
}

async function OverviewData() {
  const { status, rewards } = await getTournament();
  const [pairs, players] = await Promise.all([getAdminPairs(), getAdminPlayers()]);
  const rosterError = validateRosterComplete(
    pairs.map((p) => ({ player1Id: p.player1Id, player2Id: p.player2Id })),
    players.length,
  );
  return (
    <>
      <LifecyclePanel initialStatus={status} rosterError={rosterError} />
      <section style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid rgba(10,31,26,.1)" }}>
        <RewardsEditor initialRewards={rewards} />
      </section>
    </>
  );
}
```

- [ ] **Step 3: Remove the rewards tab from the admin nav**

In `app/admin/AdminNav.tsx`, delete the `{ href: "/admin/rewards", label: "Phần thưởng" }` entry from `ADMIN_NAV`.

- [ ] **Step 4: Delete the old rewards route**

```bash
git rm app/admin/rewards/page.tsx
rmdir app/admin/rewards 2>/dev/null || true
```
(The `RewardsEditor.tsx` was already moved out in Step 1, so the directory should now be empty.)

- [ ] **Step 5: Verify**

Run (build against local Supabase, plus lint + test):
```
npm run lint && npm run test
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local key> npm run build
```
Expected: PASS; 27 tests; `/admin/rewards` no longer in the route list; `/admin` still dynamic. Grep `grep -rn "/admin/rewards" app components` returns nothing.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(admin): move reward editing into the overview page"
```

---

### Task 2: Strip match codes and times from all displays

**Files:**
- Modify: `lib/tournament/standings.ts:288` (the `matchDisplay.meta` line)
- Modify: `app/schedule/ScheduleBoard.tsx` (round-time line ~171-173; semis meta line ~251; playoff placeholder times ~264, ~271)
- Modify: `app/HomeLiveSection.tsx` (recent-results code column ~151-161)

**Interfaces:**
- Consumes: existing `ISwissMatchDisplay`, `IRecentResult` (both keep `code` for React keys — only the DISPLAY is removed).
- Produces: no interface changes; purely removes rendered code/time strings.

- [ ] **Step 1: Drop the time from the Swiss match meta**

In `lib/tournament/standings.ts`, change the `matchDisplay` return's `meta` (currently `` meta: `${m.time} · Sân ${m.court}`, ``) to drop the time:

```ts
    meta: `Sân ${m.court}`,
```
Leave `code: m.id` in the object (still used as a React key in `ScheduleBoard`).

- [ ] **Step 2: Drop the round-time and playoff placeholder times in the schedule board**

In `app/schedule/ScheduleBoard.tsx`:
- Delete the round-time `<div>` that renders `{col.time}` (the block at ~lines 171-173).
- In the semis meta, change `{m.code} · {m.time}` (~line 251) to just `{m.code}` (keep the meaningful "BÁN KẾT 1" label, drop the time).
- In the final/3rd-place placeholder labels, change `"CHUNG KẾT · 12:00 · SÂN 1"` → `"CHUNG KẾT · SÂN 1"` and `"TRANH HẠNG 3 · 12:00 · SÂN 2"` → `"TRANH HẠNG 3 · SÂN 2"`.

- [ ] **Step 3: Drop the match-code column in home recent results**

In `app/HomeLiveSection.tsx`, in the `recent.map(...)` row, delete the `<span>` that renders `{m.code}` (the ~26px-wide code column at lines ~151-161). Keep `key={m.code}` on the row `<div>`. The row now shows: aName · score · bName.

- [ ] **Step 4: Verify no code/time leaks remain in dynamic match displays**

Run:
```
npm run lint && npm run test
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local key> npm run build
```
Then manually confirm with a dev server against local: `/schedule` shows no per-match time and no round time range; `/` recent results show no "M#" column; the 18 standings tests still pass (the `meta` change is display-only, not asserted).
Expected: PASS, 27 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/tournament/standings.ts app/schedule/ScheduleBoard.tsx app/HomeLiveSection.tsx
git commit -m "feat(admin): remove match codes and times from public displays"
```

> Note: the referee panel's own code/time display is removed in Task 4 (it rewrites that panel), so it is not touched here.

---

### Task 3: Gate the referee screen on tournament status `live`

**Files:**
- Modify: `app/admin/referee/page.tsx`
- Create: `app/admin/referee/RefereeNotLivePanel.tsx`

**Interfaces:**
- Consumes: `getTournament()` → `{ status }`, `getMatches()`, `getPairIdToTeamId()`.
- Produces: the referee page renders `RefereeScoringPanel` ONLY when `status === "live"`; otherwise a `RefereeNotLivePanel` explaining the tournament hasn't started (or is finished).

- [ ] **Step 1: Create the not-live panel**

`app/admin/referee/RefereeNotLivePanel.tsx`:

```tsx
export function RefereeNotLivePanel({ status }: { status: "setup" | "live" | "done" }) {
  const msg =
    status === "done"
      ? "Giải đã kết thúc — không thể cập nhật tỉ số."
      : "Giải chưa bắt đầu. Vào Tổng quan và bấm “Gửi đội hình & bắt đầu giải” để mở phần chấm điểm.";
  return (
    <div style={{ background: "#FFFDF7", border: "1px solid rgba(10,31,26,.12)", borderRadius: 20, padding: 28 }}>
      <h2 style={{ margin: 0, fontFamily: "var(--font-bricolage), sans-serif", fontSize: 26, fontWeight: 900 }}>
        Cập nhật tỉ số
      </h2>
      <p style={{ marginTop: 12, color: "#5B7A72", fontSize: 15 }}>{msg}</p>
    </div>
  );
}
```

- [ ] **Step 2: Gate the page on status**

Rewrite `app/admin/referee/page.tsx` so the async data child reads the status and branches (keep the Suspense shell + `dynamic="force-dynamic"`):

```tsx
import { Suspense } from "react";
import { getMatches, getPairIdToTeamId, getTournament } from "@/lib/supabase/tournament";
import { AdminSectionSkeleton } from "../AdminSectionSkeleton";
import { RefereeScoringPanel } from "./RefereeScoringPanel";
import { RefereeNotLivePanel } from "./RefereeNotLivePanel";

export const dynamic = "force-dynamic";

export default function AdminRefereePage() {
  return (
    <Suspense fallback={<AdminSectionSkeleton title="Cập nhật tỉ số" />}>
      <RefereeData />
    </Suspense>
  );
}

async function RefereeData() {
  const { status } = await getTournament();
  if (status !== "live") {
    return <RefereeNotLivePanel status={status} />;
  }
  const [matches, pairIdToTeamId] = await Promise.all([getMatches(), getPairIdToTeamId()]);
  return <RefereeScoringPanel initialMatches={matches} pairIdToTeamId={pairIdToTeamId} />;
}
```

- [ ] **Step 3: Verify**

Run lint + test + local build. Then dev-server check: with the local DB in `setup` (run `supabase db reset` then, as organizer, do NOT start), `/admin/referee` shows the not-live panel; after starting the tournament (status `live`), it shows the scoring panel. (Full organizer sign-in is manual; the branch logic is what's under test here.)
Expected: PASS, 27 tests.

- [ ] **Step 4: Commit**

```bash
git add app/admin/referee/page.tsx app/admin/referee/RefereeNotLivePanel.tsx
git commit -m "feat(admin): gate referee scoring on live tournament status"
```

---

### Task 4: Referee control state machine — single Start/End, lock-to-live, per-match reset

**Files:**
- Modify: `app/admin/referee/RefereeScoringPanel.tsx`

**Interfaces:**
- Consumes: `useLiveMatches(initialMatches, pairIdToTeamId)`, `createBrowserSupabaseClient`, `teamName`, `teamPlayersLabel`.
- Produces: a rewritten control section obeying: (1) at most one `live` match; (2) when a match is live the referee is locked to it (cannot select another); (3) the primary action is Start **xor** End depending on the selected match's state; (4) a confirm-gated per-match reset returns a live match to `next` with score 0.

**Behavior spec (the rules this task encodes):**
- `liveMatch = matches.find(m => m.state === "live")`.
- If `liveMatch` exists → `activeMatch = liveMatch`, selection is LOCKED: in the match list, only `liveMatch` is highlighted/enabled; every other match button is `disabled`. The scoreboard shows the ± controls, a single primary **"Kết thúc trận"** button (`commit("done")`), and a separate confirm-gated **"Đặt lại trận"** danger action (`resetMatch`). It does NOT show a Start button.
- If no `liveMatch` → the referee may select any `next` match (`done` matches are shown but `disabled`). The scoreboard for a selected `next` match shows NO ± controls and a single primary **"Bắt đầu trận"** button (`commit("live")`). It does NOT show an End button.
- The ± score controls render ONLY when the active match is `live`.
- `resetMatch`: `update({ score_a: 0, score_b: 0, state: "next" }).eq("code", activeMatch.id).select()`; on empty result show the no-permission message; on success optimistically patch local state. Two-step in-panel confirm (no `window.confirm`).

- [ ] **Step 1: Replace the active-match derivation and selection guard**

At the top of the component, replace the `activeId`/`selectMatch` logic with live-aware logic:

```tsx
const [matches, setMatches] = useLiveMatches(initialMatches, pairIdToTeamId);
const liveMatch = useMemo(() => matches.find((m) => m.state === "live"), [matches]);
const [selectedId, setSelectedId] = useState<string>("");
const [confirmingReset, setConfirmingReset] = useState(false);

// When a match is live, the referee is locked to it. Otherwise, the selected 'next' match (if any).
const activeMatch = useMemo(() => {
  if (liveMatch) return liveMatch;
  return matches.find((m) => m.id === selectedId && m.state === "next");
}, [liveMatch, matches, selectedId]);

function selectMatch(id: string) {
  if (liveMatch) return; // locked to the live match
  const m = matches.find((x) => x.id === id);
  if (!m || m.state !== "next") return;
  setSelectedId(id);
  setConfirmingReset(false);
}
```
Keep `draftA`/`draftB`/`saving`/`savedMsg` state, but seed drafts from `activeMatch` and reset them whenever `activeMatch?.id` changes (add a `useEffect` that syncs `draftA/draftB` to `activeMatch.sa/sb` on id change). Keep `bump`, `commit`, `commitLive` as-is.

- [ ] **Step 2: Add the single-match reset**

```tsx
async function resetMatch() {
  if (!activeMatch || saving) return;
  setSaving(true);
  try {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("matches")
      .update({ score_a: 0, score_b: 0, state: "next" })
      .eq("code", activeMatch.id)
      .select();
    if (error) return setSavedMsg(`Lỗi khi đặt lại: ${error.message}`);
    if (!data || data.length === 0)
      return setSavedMsg("Không thể đặt lại: tài khoản này không có quyền, hoặc giải chưa bắt đầu.");
    setMatches((prev) => prev.map((m) => (m.id === activeMatch.id ? { ...m, sa: 0, sb: 0, state: "next" } : m)));
    setConfirmingReset(false);
    setSelectedId("");
    setSavedMsg(`Đã đặt lại trận.`);
  } finally {
    setSaving(false);
  }
}
```

- [ ] **Step 3: Rewrite the match list to lock when a match is live and drop code/time**

In the "CHỌN TRẬN" list, each button: `const locked = !!liveMatch && m.id !== liveMatch.id;` disable it (`disabled={locked}`, reduced opacity, `cursor: not-allowed`). Selection highlight: `const selected = m.id === activeMatch?.id;`. Remove the `{m.id} · {m.time}` line entirely — show only the team names and the state badge (`STATE_LABEL[m.state]`). `done` matches are also `disabled`.

- [ ] **Step 4: Rewrite the scoreboard action area to a single Start XOR End (+ reset when live)**

Replace the current always-both-buttons block. Compute:
```tsx
const isLive = activeMatch?.state === "live";
```
Render:
- The `{activeMatch.id} · SÂN {activeMatch.court}` header → change to `SÂN {activeMatch.court}` (drop the code; time was never shown here).
- The ± controls: render ONLY when `isLive`.
- The action row:
  - when `activeMatch.state === "next"`: a single **"Bắt đầu trận"** button → `onClick={() => void commit("live")}`.
  - when `isLive`: a single **"Kết thúc trận"** button → `onClick={() => void commit("done")}`, PLUS a danger "Đặt lại trận" two-step confirm (first click sets `confirmingReset`, second click calls `resetMatch`, with a Cancel). Use `#B0435F` for the danger control, mirroring the LifecyclePanel reset styling.
- Never render both "Bắt đầu trận" and "Kết thúc trận" simultaneously.

- [ ] **Step 5: Handle the "nothing selected / nothing live" empty state**

If `!activeMatch` (no live match and nothing selected), the right-hand scoreboard shows a prompt ("Chọn một trận để bắt đầu") instead of a match. The list still renders so the referee can pick a `next` match.

- [ ] **Step 6: Verify**

Run lint + test + local build. Then a Testing-Library test for the pure state-machine decisions is worthwhile — add `app/admin/referee/__tests__/refereeControls.test.tsx` if you extract the "which action to show" decision into a tiny pure helper; otherwise verify via the dev smoke below. Minimum: verify the build + a manual dev check against local:
  - status live, no live match → list of `next` matches, selecting one shows only "Bắt đầu trận", no ±.
  - after Start → that match is live, others disabled, ± visible, "Kết thúc trận" + "Đặt lại trận" visible, "Bắt đầu trận" gone.
  - Reset (confirm) → match back to `next`, unlocked.
  - End → match `done`, unlocked, selectable `next` matches again.
Expected: PASS, tests green.

- [ ] **Step 7: Commit**

```bash
git add app/admin/referee/RefereeScoringPanel.tsx app/admin/referee/__tests__/refereeControls.test.tsx
git commit -m "feat(admin): single Start/End referee flow with lock-to-live and per-match reset"
```

---

## Test strategy

- **Existing unit tests (Vitest):** the 18 `standings.ts` tests must stay green after the display-only `meta` change (Task 2). The reward/validation tests (9) are unaffected.
- **Optional pure helper (Task 4):** if the "which primary action to show for a given match state" and "is selection locked" decisions are extracted into a pure function, unit-test it (next→start, live→end, done→none; locked when any match is live). Recommended — it isolates the state-machine rules from JSX.
- **Component/build:** `npm run build` + `npm run lint` gate every task; the referee flow is verified by the dev smoke in Task 4 Step 6 (the write paths and RLS are unchanged from the merged feature, so the risk is UI-state, not authorization).
- **No RLS re-proof needed:** Task 4's per-match reset reuses the existing `matches` UPDATE policy (organizer + status `live`); no new policy. Confirm the reset is refused when not-live via the existing `data.length === 0` guard (it will be, because the policy already requires `live`).

## Risks

- **Realtime vs. lock state:** `liveMatch` is derived from the realtime `matches` list, so if another organizer starts a match elsewhere, this referee's screen locks to it too. That is the intended single-live-match invariant — verify the lock reacts to the realtime echo, not just local writes.
- **Draft desync on active-match change:** the `useEffect` syncing `draftA/draftB` to `activeMatch.sa/sb` must key on `activeMatch?.id` (not the whole object) to avoid clobbering in-progress ± taps on every realtime tick. Get this dependency right or scores will visibly jump.
- **Two matches live at once (pre-existing data):** if the DB somehow has two `live` matches, `liveMatch` picks the first. Defensive only; the new flow prevents creating that state (Start is hidden while any match is live). Not worth special handling beyond `.find`.
- **Task 2 scope creep into playoffs:** stripping the placeholder final/3rd-place times is a small cosmetic edit; keep it to the exact strings named — don't restructure the playoff bracket.

## Handoff

Execute with `fe-plan-executor` (or subagent-driven), task by task, lint/build/tests after each, atomic commits under the user's git identity. No cloud migration is required for this plan. When complete, the referee screen is a clean state machine and Plan 2 can layer Swiss auto-generation + the tree picker on top.

---

## Self-Review

**Spec coverage:**
- "move Phần thưởng to Tổng quan as a different section" → Task 1. ✅
- "only when tournament started can referee choose a match" → Task 3 (page gate) + Task 4 (list only enabled when live). ✅
- "M1/M2/M3 + time useless, remove everywhere" → Task 2 (schedule + home) + Task 4 Step 3/4 (referee list + scoreboard header). ✅
- "once started, must End to update another; or Reset with confirmation" → Task 4 (lock-to-live + confirm-gated per-match reset). ✅
- "only Bắt đầu or Kết thúc, not both in one UI" → Task 4 Step 4 (Start xor End). ✅
- "Swiss tree + auto-generate next round" → **Plan 2** (explicitly out of scope here). ✅ (not a gap — deferred by design)
- "Swiss-rule local document" → **Plan 2 Task 1**. ✅

**Placeholder scan:** every step has concrete code or an exact edit target. Task 2's edits name exact strings/line regions. Task 4 gives the full new control logic. No "handle edge cases"/TBD. ✅

**Type consistency:** `activeMatch`, `liveMatch`, `selectedId`, `confirmingReset`, `resetMatch`, `isLive` are defined in Task 4 and used consistently within it. `RefereeNotLivePanel({ status })` (Task 3) matches its page usage. `RewardsEditor({ initialRewards })` (Task 1) matches its existing signature. ✅
