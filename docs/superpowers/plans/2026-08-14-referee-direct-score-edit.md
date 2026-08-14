# Referee Direct Score Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a referee type a team's live score directly into an editable number field, in addition to the existing +/- buttons.

**Architecture:** Frontend-only change in the referee scoring panel. The big score number for each side becomes an editable text input while the match is `live`; the referee taps it, types digits, and the value is persisted on blur / Enter (one write, not per-keystroke) through the existing `commitLive()` path. The +/- buttons stay. Parsing/sanitizing of the typed value is extracted into pure helpers in `refereeControls.ts` so it's unit-testable independent of JSX.

**Tech Stack:** Next.js (App Router) + React (client component), TypeScript, Tailwind CSS, Supabase JS (browser client), Vitest + Testing Library.

## Global Constraints

- Match rows are keyed by `code` (human id like `"M5"`) in all Supabase writes — never by uuid.
- All score writes go through `createBrowserSupabaseClient()` (organizer JWT) and rely on the existing RLS update policy; a write that matches **zero rows** (`data.length === 0`, `error === null`) means "not an organizer" and must roll back local state + show the existing RLS message. Do NOT add a new RLS policy or DB migration — reuse `commitLive`.
- Direct editing is available **only while the active match is `live`** — same gate as the +/- controls (`showScoreControls(state)`), which returns `true` only for `state === "live"`.
- Scores are non-negative integers. An empty field commits as `0`.
- Commit on **blur or Enter only** — never on every `onChange` keystroke.
- Vietnamese UI copy stays Vietnamese; keep existing `aria-label` phrasing style.
- Run `npm run test` (vitest) after each task; the task is not done until it passes.

---

## File Structure

- `app/admin/referee/refereeControls.ts` — add two pure helpers: `sanitizeScoreDigits` (strip non-digits, used live as the user types) and `parseScoreInput` (typed string → committed non-negative integer). Keeps parsing logic out of the component and unit-testable.
- `app/admin/referee/__tests__/refereeControls.test.ts` — unit tests for the two new helpers.
- `app/admin/referee/RefereeScoringPanel.tsx` — render the per-side score as an editable `<input>` while live; add edit state + handlers that commit on blur/Enter via the existing `commitLive()`. Keep the +/- buttons untouched.
- `app/admin/referee/__tests__/RefereeScoringPanel.test.tsx` — update the two existing `toHaveTextContent` score assertions (the score element is now an `<input>`, so its value is read with `toHaveValue`), and add one test for the type-then-blur commit path.

---

## Task 1: Pure score-input helpers

**Files:**
- Modify: `app/admin/referee/refereeControls.ts` (append after `matchWinnerSide`)
- Test: `app/admin/referee/__tests__/refereeControls.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `sanitizeScoreDigits(raw: string): string` — returns `raw` with every non-digit character removed (so `"2a1"` → `"21"`, `""` → `""`). Used as the `onChange` sanitizer so the field only ever holds digits.
  - `parseScoreInput(raw: string): number` — sanitizes `raw` to digits, then returns the parsed integer; empty → `0`; never negative. `"21"` → `21`, `""` → `0`, `"007"` → `7`, `"2a1"` → `21`.

- [ ] **Step 1: Write the failing tests**

Append to `app/admin/referee/__tests__/refereeControls.test.ts` (create the file with this import header if it does not already exist):

```ts
import { describe, it, expect } from "vitest";
import { sanitizeScoreDigits, parseScoreInput } from "@/app/admin/referee/refereeControls";

describe("sanitizeScoreDigits", () => {
  it("keeps only digit characters", () => {
    expect(sanitizeScoreDigits("21")).toBe("21");
    expect(sanitizeScoreDigits("2a1")).toBe("21");
    expect(sanitizeScoreDigits("-5")).toBe("5");
    expect(sanitizeScoreDigits("")).toBe("");
  });
});

describe("parseScoreInput", () => {
  it("parses digit strings to integers", () => {
    expect(parseScoreInput("21")).toBe(21);
    expect(parseScoreInput("007")).toBe(7);
  });
  it("treats empty / non-digit input as 0", () => {
    expect(parseScoreInput("")).toBe(0);
    expect(parseScoreInput("abc")).toBe(0);
  });
  it("never returns a negative number", () => {
    expect(parseScoreInput("-5")).toBe(5);
  });
});
```

> Note: if `refereeControls.test.ts` already exists with other `describe` blocks, just append these two `describe` blocks and add the two names to the existing import from `@/app/admin/referee/refereeControls`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/admin/referee/__tests__/refereeControls.test.ts`
Expected: FAIL — `sanitizeScoreDigits`/`parseScoreInput` are `undefined` / not exported.

- [ ] **Step 3: Implement the helpers**

Append to `app/admin/referee/refereeControls.ts`:

```ts
/** Strip every non-digit from raw input; used to sanitize the editable score field as the user types. */
export function sanitizeScoreDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Parse a typed score field into the integer to commit. Non-digits are stripped first,
 * an empty field commits as 0, and the result is never negative.
 */
export function parseScoreInput(raw: string): number {
  const digits = sanitizeScoreDigits(raw);
  if (digits === "") return 0;
  const n = Number.parseInt(digits, 10);
  return Number.isNaN(n) || n < 0 ? 0 : n;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/admin/referee/__tests__/refereeControls.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/admin/referee/refereeControls.ts app/admin/referee/__tests__/refereeControls.test.ts
git commit -m "feat(referee): add score-input parse/sanitize helpers"
```

---

## Task 2: Editable score field in the referee panel

**Files:**
- Modify: `app/admin/referee/RefereeScoringPanel.tsx`
- Test: `app/admin/referee/__tests__/RefereeScoringPanel.test.tsx`

**Interfaces:**
- Consumes: `sanitizeScoreDigits`, `parseScoreInput` (Task 1); the existing `commitLive(scoreA: number, scoreB: number): Promise<void>` and `showScoreControls(state)` already in the file.
- Produces: no new exported symbols. Behavior contract for the tests:
  - While the active match is `live`, each side's big number renders as `<input data-testid="ref-score-a" | "ref-score-b">` whose value equals the current draft score (`String(draftA)` / `String(draftB)`).
  - Typing digits + blur (or Enter) calls `commitLive` with the parsed side value and the other side's current draft, writing `{ score_a, score_b, state: "live" }` keyed by `code`.

- [ ] **Step 1: Update the two existing score assertions (now an input) and add the new blur-commit test**

In `app/admin/referee/__tests__/RefereeScoringPanel.test.tsx`:

Change the two existing assertions that read the score element as text — the element is now an `<input>`, so read its value:

```ts
// in "optimistically increments the score…":
expect(screen.getByTestId("ref-score-a")).toHaveValue("5");   // was toHaveTextContent("5")
// …after clicking +:
expect(screen.getByTestId("ref-score-a")).toHaveValue("6");   // was toHaveTextContent("6")

// in the RLS rollback test, the final assertion:
await waitFor(() => expect(screen.getByTestId("ref-score-a")).toHaveValue("5")); // was toHaveTextContent("5")
```

Add this new test to the same `describe` block:

```ts
it("types a score directly and commits it on blur", async () => {
  const { update, eq } = makeSupabase({ data: [{}], error: null });

  const user = userEvent.setup();
  render(<RefereeScoringPanel initialMatches={[LIVE_MATCH]} pairIdToTeamId={{}} teams={TEAMS} />);

  const inputA = screen.getByTestId("ref-score-a");
  await user.clear(inputA);
  await user.type(inputA, "21");
  await user.tab(); // blur

  expect(inputA).toHaveValue("21");
  await waitFor(() =>
    expect(update).toHaveBeenCalledWith({ score_a: 21, score_b: 3, state: "live" }),
  );
  expect(eq).toHaveBeenCalledWith("code", "M1");
});
```

- [ ] **Step 2: Run the panel tests to verify the new test fails**

Run: `npx vitest run app/admin/referee/__tests__/RefereeScoringPanel.test.tsx`
Expected: FAIL — `ref-score-a` is currently a `<div>` (no editable value / `.toHaveValue` fails; typing does nothing).

- [ ] **Step 3: Add edit state + handlers in `RefereeScoringPanel.tsx`**

Update the import from `./refereeControls` to include the new helpers:

```tsx
import { isSelectable, matchWinnerSide, parseScoreInput, primaryAction, sanitizeScoreDigits, showScoreControls } from "./refereeControls";
```

Add edit state next to the other `useState` hooks (near `draftA`/`draftB`, around lines 76–80):

```tsx
// While the referee is typing directly into a side's score field, `editingSide` marks which
// side is being edited and `editValue` holds the raw (digits-only) buffer so partial input like
// "" mid-type isn't force-parsed to 0 until commit. null = not editing (field mirrors the draft).
const [editingSide, setEditingSide] = useState<"a" | "b" | null>(null);
const [editValue, setEditValue] = useState<string>("");
```

Add these handlers next to `bump` (after the `bump` function, before `commitLive`):

```tsx
/** Focus a side's score field for direct typing: seed the buffer with the current draft. */
function startEdit(side: "a" | "b") {
  setEditingSide(side);
  setEditValue(String(side === "a" ? draftA : draftB));
}

/** onChange while typing: keep only digits in the buffer (never write to DB here). */
function changeEdit(raw: string) {
  setEditValue(sanitizeScoreDigits(raw));
}

/**
 * Commit the typed score on blur / Enter: parse the buffer to a non-negative integer, update the
 * draft for that side, and persist via the same `commitLive` used by the ± buttons (writes
 * score_a/score_b with state:"live", rolls back on RLS/zero-row/error). Passes the parsed value
 * explicitly (not the async-updated draft) so the write uses the just-typed number.
 */
function commitEdit(side: "a" | "b") {
  const n = parseScoreInput(editValue);
  if (side === "a") {
    setDraftA(n);
    void commitLive(n, draftB);
  } else {
    setDraftB(n);
    void commitLive(draftA, n);
  }
  setEditingSide(null);
}
```

- [ ] **Step 4: Swap the side-A and side-B score `<div>` for an editable `<input>` while live**

Replace the side-A score display (currently the `<div data-testid="ref-score-a" …>{draftA}</div>`, around lines 311–317) with:

```tsx
{showScoreControls(activeMatch.state) ? (
  <input
    data-testid="ref-score-a"
    inputMode="numeric"
    aria-label={`Tỉ số đội ${teamName(activeMatch.a)}`}
    value={editingSide === "a" ? editValue : String(draftA)}
    onFocus={() => startEdit("a")}
    onChange={(e) => changeEdit(e.target.value)}
    onBlur={() => commitEdit("a")}
    onKeyDown={(e) => {
      if (e.key === "Enter") e.currentTarget.blur();
    }}
    className="my-[14px] w-full bg-transparent text-center outline-none font-[family-name:var(--font-jetbrains)] text-[clamp(46px,9vw,68px)] leading-none"
    style={{ fontWeight: activeWinner === "a" ? 900 : 700, color: activeWinner === "a" ? "#3FBF8F" : "#FFFDF7" }}
  />
) : (
  <div
    data-testid="ref-score-a"
    className="my-[14px] font-[family-name:var(--font-jetbrains)] text-[clamp(46px,9vw,68px)] leading-none"
    style={{ fontWeight: activeWinner === "a" ? 900 : 700, color: activeWinner === "a" ? "#3FBF8F" : "#FFFDF7" }}
  >
    {draftA}
  </div>
)}
```

Replace the side-B score display (`<div data-testid="ref-score-b" …>{draftB}</div>`, around lines 359–365) with the mirror version:

```tsx
{showScoreControls(activeMatch.state) ? (
  <input
    data-testid="ref-score-b"
    inputMode="numeric"
    aria-label={`Tỉ số đội ${teamName(activeMatch.b)}`}
    value={editingSide === "b" ? editValue : String(draftB)}
    onFocus={() => startEdit("b")}
    onChange={(e) => changeEdit(e.target.value)}
    onBlur={() => commitEdit("b")}
    onKeyDown={(e) => {
      if (e.key === "Enter") e.currentTarget.blur();
    }}
    className="my-[14px] w-full bg-transparent text-center outline-none font-[family-name:var(--font-jetbrains)] text-[clamp(46px,9vw,68px)] leading-none"
    style={{ fontWeight: activeWinner === "b" ? 900 : 700, color: activeWinner === "b" ? "#3FBF8F" : "#FFFDF7" }}
  />
) : (
  <div
    data-testid="ref-score-b"
    className="my-[14px] font-[family-name:var(--font-jetbrains)] text-[clamp(46px,9vw,68px)] leading-none"
    style={{ fontWeight: activeWinner === "b" ? 900 : 700, color: activeWinner === "b" ? "#3FBF8F" : "#FFFDF7" }}
  >
    {draftB}
  </div>
)}
```

Leave the existing +/- `<Button>` blocks (side A around lines 318–339, side B around 366–387) and everything else unchanged.

- [ ] **Step 5: Run the panel tests to verify they pass**

Run: `npx vitest run app/admin/referee/__tests__/RefereeScoringPanel.test.tsx`
Expected: PASS (updated `toHaveValue` assertions + the new type-then-blur test).

- [ ] **Step 6: Run the full suite + lint**

Run: `npm run test && npm run lint`
Expected: PASS, no lint errors.

- [ ] **Step 7: Commit**

```bash
git add app/admin/referee/RefereeScoringPanel.tsx app/admin/referee/__tests__/RefereeScoringPanel.test.tsx
git commit -m "feat(referee): allow direct typing of team score alongside +/-"
```

---

## Self-Review

**1. Spec coverage:**
- "Chỉnh trực tiếp tỉ số một đội thay vì +/-" → Task 2 renders each side's score as an editable input (direct typing). ✔
- "Giữ +/- và thêm gõ trực tiếp" (user decision) → +/- buttons are explicitly left unchanged; input added alongside. ✔
- "Lưu khi rời ô / nhấn Enter" (user decision) → commit happens in `onBlur` and Enter routes to blur; `onChange` never writes. ✔
- Non-negative integer / empty → 0 → `parseScoreInput` (Task 1), unit-tested. ✔
- Only while live → both inputs gated by `showScoreControls(activeMatch.state)`. ✔
- Reuse existing write path / RLS → commit goes through existing `commitLive` (no new policy/migration). ✔

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows concrete code. ✔

**3. Type consistency:** Helper names identical across tasks and call sites — `sanitizeScoreDigits`, `parseScoreInput` (defined Task 1, imported/used Task 2). `commitLive(scoreA, scoreB)`, `showScoreControls`, `draftA`/`draftB`, `activeWinner`, `teamName` all match the existing `RefereeScoringPanel.tsx`. Test uses `toHaveValue` (input) consistently after the div→input swap. ✔

**Known follow-ups (out of scope, unchanged from current behavior):** no optimistic-concurrency lock (last-write-wins, already documented in the panel header comment); no upper bound on score (matches current unlimited-+ behavior).
