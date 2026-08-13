# Plan B — Trận playoff thật + resolve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **PHỤ THUỘC:** Plan A phải xong trước (đã có `computeSeeds`, `ISemiMatch.aTeamId`, `computeSemis(seeds)`, `computeFinals(semis)`). Plan B *mở rộng* các hàm này để đọc trận thật.

**Goal:** Khi 4 đội đủ suất, hệ thống tự sinh 2 bán kết thật; khi 2 bán kết xong, tự sinh Chung kết (2 đội thắng) + Tranh hạng 3 (2 đội thua); referee chấm điểm được; `/schedule` resolve tên + tỉ số thật, placeholder khi chưa có.

**Architecture:** Trận playoff là **match row thật** trong bảng `matches` — `round_n=6` (bán kết: sân 1 = BK1 seed1×seed4, sân 2 = BK2 seed2×seed3), `round_n=7` (sân 1 = Chung kết, sân 2 = Tranh hạng 3). Engine pure `lib/tournament/playoffs.ts` quyết định cặp đấu; Server Action `ensurePlayoffs()` (song song với `ensureNextRound()`) chèn row, idempotent. Resolve hiển thị đọc thẳng match row round 6/7. Liên kết Final/3rd → bán kết theo **quy ước round_n+court** (không thêm cột → migration nhẹ, an toàn giữa giải).

**Tech Stack:** Next.js App Router, TypeScript, Supabase (Postgres + RLS), Vitest.

## Global Constraints

- `npm run build` PHẢI pass trước mọi commit.
- TDD: Red → Green → Refactor. Engine pure test được không cần DB.
- Atomic commits, title-only, git identity của user.
- **Giải đang live (2026-08-13).** Migration chỉ THÊM `rounds` meta — KHÔNG sửa RLS/policy hiện có, KHÔNG xóa dữ liệu. Chạy `supabase db reset` chỉ trên local.
- Seeding/luật playoff phải trace về `.memory/knowledge/swiss-format.md` (Task 1 cập nhật doc trước).
- Quy ước: bán kết `round_n=6` (court 1=BK1, court 2=BK2); chung kết/hạng 3 `round_n=7` (court 1=CK, court 2=H3).
- BYE/hòa không áp dụng cho playoff (Bo1, no deuce — luôn có đội thắng).

## Ràng buộc RLS đã xác nhận (không cần đổi)
- INSERT: policy `organizers can insert matches` — `with check (is_organizer())`, không gate phase → `ensurePlayoffs` chèn được khi organizer.
- UPDATE điểm: `organizers score matches when live` → referee chấm playoff khi `status='live'`. ✓
- `reset_tournament()` đã `delete ... where round_n >= 2` → xóa cả playoff. ✓

---

## File Structure

- `.memory/knowledge/swiss-format.md` — thay mục "Terminal / playoffs" (hiện ghi OUT OF SCOPE) bằng luật playoff chính thức.
- `supabase/migrations/20260813120000_playoffs_rounds.sql` — chèn `rounds` meta n=6, n=7 (idempotent).
- `lib/tournament/playoffs.ts` — engine pure: seed ids, `generateSemis`, `generateFinals`, `winnerOf/loserOf`.
- `lib/tournament/__tests__/playoffs.test.ts` — test engine.
- `app/admin/referee/ensurePlayoffs.ts` — Server Action chèn semis/finals, idempotent.
- `app/admin/referee/RefereeScoringPanel.tsx` — gọi `ensurePlayoffs()` cạnh `ensureNextRound()` khi kết thúc trận.
- `app/admin/referee/page.tsx` — preload `await ensurePlayoffs()` cạnh `ensureNextRound()`.
- `app/admin/referee/RefereePlayoffPicker.tsx` (mới) — cho referee chọn/chấm trận round 6/7; nhúng vào referee page.
- `lib/tournament/standings.ts` — `computeSemis`/`computeFinals` mở rộng nhận `matches` để resolve.
- `app/schedule/ScheduleBoard.tsx` — cập nhật call site truyền `matches`.
- `lib/tournament/data.ts` — thêm `PLAYOFF_ROUND_META` (n=6,7) cho seed/local.

**Interfaces mới (Task 3 khai báo; Task sau phụ thuộc):**
```ts
// lib/tournament/playoffs.ts
export interface IPlayoffRow { code: string; round: number; court: number; aTeamId: number; bTeamId: number; }
export function qualifiedSeedIds(matches: IMatch[], teams: ITeam[]): number[]; // rank, chỉ w>=3
export function generateSemis(matches: IMatch[], teams: ITeam[]): IPlayoffRow[] | null; // null nếu chưa đủ 4 hoặc đã có round 6
export function winnerOf(m: IMatch): number | null; // team id thắng, null nếu chưa done
export function loserOf(m: IMatch): number | null;
export function generateFinals(matches: IMatch[]): IPlayoffRow[] | null; // null nếu 2 BK chưa done hoặc đã có round 7

// standings.ts (mở rộng chữ ký Plan A)
export function computeSemis(seeds: ITeamChip[], matches: IMatch[], teams: ITeam[]): ISemiMatch[];
export function computeFinals(semis: ISemiMatch[], matches: IMatch[], teams: ITeam[]): { final: IFinalMatch; third: IFinalMatch };
```

---

### Task 1: Cập nhật luật playoff trong memory doc (nguồn chân lý)

**Files:**
- Modify: `.memory/knowledge/swiss-format.md` (mục "Terminal / playoffs")

- [ ] **Step 1: Thay mục "Terminal / playoffs"**

Thay đoạn "Playoff (semifinal/final) match generation is OUT OF SCOPE..." bằng:
```markdown
## Terminal / playoffs (approved 2026-08-13 — now IN scope)
- Swiss round generation stops when <2 alive pairs remain OR 4 pairs Qualified.
- **Seeding** (4 qualified → seed1..4): wins desc → point differential (pf−pa) desc →
  head-to-head (đội thắng trực tiếp trên) → letter A→H asc.
- **Semifinals** (`round_n=6`, generated when 4 qualified, none exist yet):
  - Sân 1 = Bán kết 1 = seed1 vs seed4; Sân 2 = Bán kết 2 = seed2 vs seed3.
- **Final + 3rd place** (`round_n=7`, generated when BOTH semis `done`, none exist yet):
  - Sân 1 = Chung kết = thắng BK1 vs thắng BK2.
  - Sân 2 = Tranh hạng 3 = thua BK1 vs thua BK2.
- Bo1, no deuce → mọi trận playoff luôn có đúng 1 đội thắng (không bye, không hòa).
- Sinh trận idempotent qua `ensurePlayoffs()` (giống `ensureNextRound()`), gọi sau mỗi trận kết thúc.
- Liên kết Final/3rd → bán kết theo quy ước `round_n`+`court` (không lưu cột nguồn).
```

- [ ] **Step 2: Commit**
```bash
git add .memory/knowledge/swiss-format.md
git commit -m "docs(swiss): bring playoff generation into scope with seeding rules"
```

---

### Task 2: Migration — `rounds` meta cho vòng playoff

**Files:**
- Create: `supabase/migrations/20260813120000_playoffs_rounds.sql`

- [ ] **Step 1: Viết migration (chỉ INSERT meta, idempotent)**
```sql
-- Playoffs: thêm rounds meta cho bán kết (n=6) và chung kết/hạng 3 (n=7).
-- Không đụng RLS/policy: INSERT/UPDATE matches đã đủ (organizers insert; score khi live).
-- reset_tournament() đã xóa round_n >= 2 nên cũng dọn playoff.

insert into public.rounds (n, title, time_label, sub)
values
  (6, 'Bán kết', '11:30', 'Board 2 · 4 đội qualified'),
  (7, 'Chung kết / Hạng 3', '12:15', 'Board 2 · tranh cúp')
on conflict (n) do nothing;
```
> Người thực thi: xác nhận `rounds.n` là unique/PK (xem init schema) để `on conflict (n)` hợp lệ; nếu unique nằm ở cột khác, đổi target cho khớp.

- [ ] **Step 2: Áp dụng local + kiểm tra**

Run: `supabase db reset` (chỉ local) rồi kiểm tra:
```bash
supabase db reset
psql "$LOCAL_DB_URL" -c "select n, title from public.rounds where n in (6,7);"
```
Expected: 2 dòng n=6, n=7.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/20260813120000_playoffs_rounds.sql
git commit -m "feat(db): add playoff rounds meta (semis, final/3rd)"
```

---

### Task 3: Engine pure `lib/tournament/playoffs.ts` — seeds + generateSemis

**Files:**
- Create: `lib/tournament/playoffs.ts`
- Test: `lib/tournament/__tests__/playoffs.test.ts`

**Interfaces:**
- Consumes: `IMatch`, `ITeam`, `buildTeamRecords`, `computeSeeds` (từ Plan A).
- Produces: `qualifiedSeedIds`, `generateSemis`, `winnerOf`, `loserOf` (xem block Interfaces trên).

- [ ] **Step 1: Viết test đỏ**
```ts
import { describe, it, expect } from "vitest";
import { TEAMS, type IMatch } from "../data";
import { qualifiedSeedIds, generateSemis, winnerOf, loserOf } from "../playoffs";

const done = (id: string, r: number, a: number, b: number, sa: number, sb: number): IMatch => ({
  id, round: r, court: 1, time: "", a, b, sa, sb, state: "done",
});
// 4 đội (1,2,3,4) đủ 3 thắng với hiệu số giảm dần 1>2>3>4.
const fourQualified: IMatch[] = [
  done("a1",1,1,5,21,1), done("a2",2,1,6,21,2), done("a3",3,1,7,21,3),
  done("b1",1,2,6,21,5), done("b2",2,2,7,21,6), done("b3",3,2,8,21,7),
  done("c1",1,3,7,21,10), done("c2",2,3,8,21,11), done("c3",3,3,5,21,12),
  done("d1",1,4,8,21,14), done("d2",2,4,5,21,15), done("d3",3,4,6,21,16),
];

describe("qualifiedSeedIds", () => {
  it("trả 4 đội đủ 3 thắng theo thứ tự seed hiệu số giảm dần", () => {
    expect(qualifiedSeedIds(fourQualified, TEAMS)).toEqual([1, 2, 3, 4]);
  });
  it("trả rỗng khi chưa đủ 4 đội qualified", () => {
    expect(qualifiedSeedIds([done("x",1,1,2,21,5)], TEAMS)).toEqual([]);
  });
});

describe("generateSemis", () => {
  it("sinh 2 bán kết: sân1 seed1×seed4, sân2 seed2×seed3", () => {
    const rows = generateSemis(fourQualified, TEAMS)!;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ round: 6, court: 1, aTeamId: 1, bTeamId: 4, code: "R6-1" });
    expect(rows[1]).toMatchObject({ round: 6, court: 2, aTeamId: 2, bTeamId: 3, code: "R6-2" });
  });
  it("null khi chưa đủ 4 qualified", () => {
    expect(generateSemis([done("x",1,1,2,21,5)], TEAMS)).toBeNull();
  });
  it("null khi đã tồn tại round 6 (idempotent)", () => {
    const withSemis = [...fourQualified, done("R6-1",6,1,4,21,10)];
    expect(generateSemis(withSemis, TEAMS)).toBeNull();
  });
});

describe("winnerOf / loserOf", () => {
  const m = done("R6-1", 6, 1, 4, 21, 15);
  it("winner = đội điểm cao, loser = đội điểm thấp", () => {
    expect(winnerOf(m)).toBe(1);
    expect(loserOf(m)).toBe(4);
  });
  it("null khi trận chưa done", () => {
    expect(winnerOf({ ...m, state: "live" })).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test đỏ**

Run: `npm run test -- playoffs`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Cài đặt `playoffs.ts`**
```ts
/**
 * Pure playoff engine (Board 2). Implements `.memory/knowledge/swiss-format.md` "Terminal /
 * playoffs". Framework-free, DB-free — callers (ensurePlayoffs Server Action) apply the rows.
 * Quy ước: bán kết round_n=6 (court1=BK1, court2=BK2); chung kết/hạng3 round_n=7 (court1=CK, court2=H3).
 */
import type { IMatch, ITeam } from "@/lib/tournament/data";
import { buildTeamRecords, computeSeeds } from "@/lib/tournament/standings";

export interface IPlayoffRow {
  code: string;
  round: number;
  court: number;
  aTeamId: number;
  bTeamId: number;
}

export function qualifiedSeedIds(matches: IMatch[], teams: ITeam[]): number[] {
  const records = buildTeamRecords(matches, teams);
  const seeds = computeSeeds(matches, records, teams);
  return seeds.length >= 4 ? seeds.slice(0, 4).map((s) => s.teamId) : [];
}

export function winnerOf(m: IMatch): number | null {
  if (m.state !== "done") return null;
  return m.sa > m.sb ? m.a : m.sb > m.sa ? m.b : null;
}

export function loserOf(m: IMatch): number | null {
  if (m.state !== "done") return null;
  return m.sa > m.sb ? m.b : m.sb > m.sa ? m.a : null;
}

/** 2 bán kết khi đủ 4 qualified và chưa có round 6. */
export function generateSemis(matches: IMatch[], teams: ITeam[]): IPlayoffRow[] | null {
  if (matches.some((m) => m.round === 6)) return null; // idempotent
  const seeds = qualifiedSeedIds(matches, teams);
  if (seeds.length < 4) return null;
  return [
    { code: "R6-1", round: 6, court: 1, aTeamId: seeds[0], bTeamId: seeds[3] },
    { code: "R6-2", round: 6, court: 2, aTeamId: seeds[1], bTeamId: seeds[2] },
  ];
}

/** Chung kết + hạng 3 khi cả 2 bán kết done và chưa có round 7. */
export function generateFinals(matches: IMatch[]): IPlayoffRow[] | null {
  if (matches.some((m) => m.round === 7)) return null; // idempotent
  const bk1 = matches.find((m) => m.round === 6 && m.court === 1);
  const bk2 = matches.find((m) => m.round === 6 && m.court === 2);
  if (!bk1 || !bk2 || bk1.state !== "done" || bk2.state !== "done") return null;
  const w1 = winnerOf(bk1)!, w2 = winnerOf(bk2)!;
  const l1 = loserOf(bk1)!, l2 = loserOf(bk2)!;
  return [
    { code: "R7-1", round: 7, court: 1, aTeamId: w1, bTeamId: w2 }, // Chung kết
    { code: "R7-2", round: 7, court: 2, aTeamId: l1, bTeamId: l2 }, // Hạng 3
  ];
}
```

- [ ] **Step 4: Thêm test cho `generateFinals` (đỏ→xanh cùng file)**
```ts
import { generateFinals } from "../playoffs";
describe("generateFinals", () => {
  const base = [...fourQualified,
    done("R6-1", 6, 1, 4, 21, 10), // BK1: đội1 thắng đội4
    { ...done("R6-2", 6, 2, 3, 21, 12), court: 2 }, // BK2: đội2 thắng đội3
  ];
  it("chung kết = thắng BK1 vs thắng BK2, hạng 3 = thua vs thua", () => {
    const rows = generateFinals(base)!;
    expect(rows[0]).toMatchObject({ round: 7, court: 1, aTeamId: 1, bTeamId: 2 });
    expect(rows[1]).toMatchObject({ round: 7, court: 2, aTeamId: 4, bTeamId: 3 });
  });
  it("null khi một bán kết chưa done", () => {
    const notDone = base.map((m) => (m.id === "R6-2" ? { ...m, state: "live" as const } : m));
    expect(generateFinals(notDone)).toBeNull();
  });
});
```

- [ ] **Step 5: Chạy test xanh**

Run: `npm run test -- playoffs`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add lib/tournament/playoffs.ts lib/tournament/__tests__/playoffs.test.ts
git commit -m "feat(playoffs): pure engine for semis/final generation and seeding"
```

---

### Task 4: Server Action `ensurePlayoffs()` (chèn semis rồi finals, idempotent)

**Files:**
- Create: `app/admin/referee/ensurePlayoffs.ts`

**Interfaces:**
- Consumes: `generateSemis`, `generateFinals`, `getMatches`, `getPairCodeToId`, `teamIdToLetter` (như `ensureNextRound.ts`).
- Produces: `ensurePlayoffs(): Promise<{ generated: 'semis' | 'finals' | null }>`.

- [ ] **Step 1: Cài đặt (mô phỏng `ensureNextRound.ts`)**
```ts
"use server";

import { createAuthServerClient } from "@/lib/supabase/serverClient";
import { getMatches, getPairCodeToId } from "@/lib/supabase/tournament";
import { getTeams } from "@/lib/supabase/tournament";
import { generateSemis, generateFinals, type IPlayoffRow } from "@/lib/tournament/playoffs";
import { teamIdToLetter } from "@/lib/tournament/data";

/**
 * Organizer-guarded Server Action song song với ensureNextRound: khi 4 đội qualified thì chèn 2
 * bán kết (round 6); khi 2 bán kết done thì chèn chung kết + hạng 3 (round 7). Idempotent — engine
 * trả null nếu round tương ứng đã tồn tại.
 */
export async function ensurePlayoffs(): Promise<{ generated: "semis" | "finals" | null }> {
  const supabase = await createAuthServerClient();
  const { data: isOrg } = await supabase.rpc("is_organizer");
  if (isOrg !== true) return { generated: null };

  const [matches, teams, codeToId] = await Promise.all([getMatches(), getTeams(), getPairCodeToId()]);

  const insertRows = async (rows: IPlayoffRow[]) => {
    const payload = rows.map((r) => ({
      code: r.code,
      round_n: r.round,
      court: r.court,
      time_label: "",
      pair_a_id: codeToId[teamIdToLetter(r.aTeamId)],
      pair_b_id: codeToId[teamIdToLetter(r.bTeamId)],
      score_a: 0,
      score_b: 0,
      state: "next" as const,
    }));
    const { error } = await supabase.from("matches").insert(payload).select();
    if (error) {
      console.error(`[ensurePlayoffs] insert round ${rows[0]?.round} failed:`, error.message);
      return false;
    }
    return true;
  };

  const semis = generateSemis(matches, teams);
  if (semis) return { generated: (await insertRows(semis)) ? "semis" : null };

  const finals = generateFinals(matches);
  if (finals) return { generated: (await insertRows(finals)) ? "finals" : null };

  return { generated: null };
}
```
> Ghi chú: nếu vừa sinh semis xong thì KHÔNG sinh finals cùng lượt (semis chưa done) — thứ tự `if` đảm bảo điều đó. Finals chỉ sinh ở lượt gọi sau khi 2 bán kết đã done.

- [ ] **Step 2: Kiểm tra type-check/build**

Run: `npm run build`
Expected: build pass (Server Action hợp lệ).

- [ ] **Step 3: Commit**
```bash
git add app/admin/referee/ensurePlayoffs.ts
git commit -m "feat(referee): ensurePlayoffs server action inserts semis then final/3rd"
```

---

### Task 5: Gọi `ensurePlayoffs()` khi kết thúc trận + preload

**Files:**
- Modify: `app/admin/referee/RefereeScoringPanel.tsx` (dòng ~25 import, ~203 sau `void ensureNextRound();`)
- Modify: `app/admin/referee/page.tsx` (dòng ~4 import, ~25 sau `await ensureNextRound();`)
- Test: `app/admin/referee/__tests__/RefereeScoringPanel.test.tsx` (mock `ensurePlayoffs` như đã mock `ensureNextRound`)

- [ ] **Step 1: Viết/độ test đỏ**

Trong `RefereeScoringPanel.test.tsx`, thêm mock cạnh mock ensureNextRound:
```ts
vi.mock("@/app/admin/referee/ensurePlayoffs", () => ({ ensurePlayoffs: vi.fn() }));
```
Và assert nó được gọi khi commit trận "done":
```ts
import { ensurePlayoffs } from "@/app/admin/referee/ensurePlayoffs";
// ... trong test kết thúc trận:
expect(ensurePlayoffs).toHaveBeenCalled();
```

- [ ] **Step 2: Chạy test đỏ**

Run: `npm run test -- RefereeScoringPanel`
Expected: FAIL — `ensurePlayoffs` chưa được gọi.

- [ ] **Step 3: Cài đặt gọi hàm**

`RefereeScoringPanel.tsx`:
```ts
import { ensurePlayoffs } from "./ensurePlayoffs"; // cạnh import ensureNextRound
```
Ngay sau `void ensureNextRound();` (dòng ~203):
```ts
void ensurePlayoffs();
```
`page.tsx`:
```ts
import { ensurePlayoffs } from "./ensurePlayoffs";
// sau: await ensureNextRound();
await ensurePlayoffs();
```

- [ ] **Step 4: Chạy test xanh**

Run: `npm run test -- RefereeScoringPanel`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add app/admin/referee/RefereeScoringPanel.tsx app/admin/referee/page.tsx app/admin/referee/__tests__/RefereeScoringPanel.test.tsx
git commit -m "feat(referee): trigger ensurePlayoffs on match end and page load"
```

---

### Task 6: Referee chọn/chấm trận playoff (`RefereePlayoffPicker`)

**Files:**
- Create: `app/admin/referee/RefereePlayoffPicker.tsx`
- Modify: `app/admin/referee/page.tsx` (nhúng picker khi có match round 6/7)
- Test: `app/admin/referee/__tests__/RefereePlayoffPicker.test.tsx`

**Interfaces:**
- Consumes: `IMatch[]` (đã lọc round 6/7), `ITeam[]`, `isSelectable` (refereeControls), pattern chọn match giống `RefereeSwissPicker`.
- Produces: UI list các trận playoff, dùng cùng cơ chế `onSelect(code)` để nạp vào scoreboard.

- [ ] **Step 1: Viết test đỏ (render + selectable)**
```tsx
import { render, screen } from "@testing-library/react";
import { RefereePlayoffPicker } from "../RefereePlayoffPicker";
import { TEAMS, type IMatch } from "@/lib/tournament/data";
import { TeamLookupProvider } from "@/lib/tournament/teamLookup";

const semis: IMatch[] = [
  { id: "R6-1", round: 6, court: 1, time: "", a: 1, b: 4, sa: 0, sb: 0, state: "next" },
  { id: "R6-2", round: 6, court: 2, time: "", a: 2, b: 3, sa: 0, sb: 0, state: "next" },
];
it("hiện các trận bán kết để chọn", () => {
  render(
    <TeamLookupProvider teams={TEAMS}>
      <RefereePlayoffPicker matches={semis} liveMatch={undefined} activeId={null} onSelect={() => {}} />
    </TeamLookupProvider>,
  );
  expect(screen.getByText(/Bán kết/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Chạy test đỏ**

Run: `npm run test -- RefereePlayoffPicker`
Expected: FAIL — component chưa tồn tại.

- [ ] **Step 3: Cài đặt picker** (bám style `RefereeSwissPicker.tsx`)
```tsx
"use client";

import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { IMatch } from "@/lib/tournament/data";
import { useTeamLookup } from "@/lib/tournament/teamLookup";
import { isSelectable } from "./refereeControls";

function labelFor(m: IMatch): string {
  if (m.round === 6) return m.court === 1 ? "Bán kết 1" : "Bán kết 2";
  return m.court === 1 ? "Chung kết" : "Tranh hạng 3";
}

interface IProps {
  matches: IMatch[];
  liveMatch: { id: string } | undefined;
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function RefereePlayoffPicker({ matches, liveMatch, activeId, onSelect }: IProps) {
  const getTeam = useTeamLookup();
  if (matches.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="mb-2 font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[.16em] text-[#5B7A72]">
        BOARD 2 · PLAYOFFS
      </div>
      <div className="flex flex-col gap-2">
        {matches.map((m) => {
          const selectable = isSelectable({ id: m.id, state: m.state }, liveMatch);
          const a = getTeam(m.a);
          const b = getTeam(m.b);
          return (
            <button
              key={m.id}
              type="button"
              disabled={!selectable}
              onClick={() => onSelect(m.id)}
              className="block w-full rounded-[9px] border p-2 text-left"
              style={{
                background: activeId === m.id ? "rgba(11,93,78,.08)" : "#fff",
                border: activeId === m.id ? "1.5px solid #0B5D4E" : "1px solid rgba(10,31,26,.12)",
                opacity: selectable ? 1 : 0.5,
                cursor: selectable ? "pointer" : "default",
              }}
            >
              <div className="text-[10px] font-bold text-[#5B7A72]">{labelFor(m)}</div>
              <div className="mt-1 flex items-center gap-2 text-[12px] font-bold">
                {a.players.map((p) => <PlayerAvatar key={p.name} player={p} size={16} />)}
                {a.name} <span className="text-[#B4BEBA]">vs</span> {b.name}
                {b.players.map((p) => <PlayerAvatar key={p.name} player={p} size={16} />)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Nhúng vào referee page**

Trong `app/admin/referee/page.tsx` (hoặc component client chứa picker Swiss), lọc `matches` round 6/7 và render `<RefereePlayoffPicker .../>` bên dưới picker Swiss, truyền cùng `liveMatch/activeId/onSelect` state đang dùng cho Swiss picker.
> Người thực thi: đọc cách `RefereeSwissPicker` được truyền props trong page/parent client component để nối đúng state chọn trận (single source of truth cho `activeId`).

- [ ] **Step 5: Chạy test xanh + build**

Run: `npm run test -- RefereePlayoffPicker && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add app/admin/referee/RefereePlayoffPicker.tsx app/admin/referee/page.tsx app/admin/referee/__tests__/RefereePlayoffPicker.test.tsx
git commit -m "feat(referee): playoff match picker for scoring semis and final/3rd"
```

---

### Task 7: Resolve `computeSemis`/`computeFinals` từ match round 6/7 thật

**Files:**
- Modify: `lib/tournament/standings.ts` (mở rộng `computeSemis`, `computeFinals`)
- Modify: `app/schedule/ScheduleBoard.tsx` (cập nhật call site)
- Test: `lib/tournament/__tests__/standings.test.ts`

**Interfaces:**
- Consumes: `IMatch[]` round 6/7, `computeSeeds`, `winnerOf/loserOf` (import từ playoffs? — tránh vòng lặp import: standings KHÔNG được import playoffs vì playoffs import standings. Nên định nghĩa winner/loser cục bộ trong standings).
- Produces: semis/finals hiển thị tên + tỉ số + `teamId` thật khi có row round 6/7; placeholder Plan A khi chưa có.

- [ ] **Step 1: Viết test đỏ**
```ts
describe("computeSemis/computeFinals resolve real playoff rows", () => {
  const semiRows: IMatch[] = [
    { id: "R6-1", round: 6, court: 1, time: "", a: 1, b: 4, sa: 21, sb: 15, state: "done" },
    { id: "R6-2", round: 6, court: 2, time: "", a: 2, b: 3, sa: 21, sb: 18, state: "done" },
  ];
  it("semis hiện đội + tỉ số thật khi có round 6", () => {
    const semis = computeSemis([], semiRows, TEAMS); // seeds bỏ qua khi có row thật
    expect(semis[0]).toMatchObject({ aTeamId: 1, bTeamId: 4 });
    expect(semis[0].aName).toContain(TEAMS[0].name);
  });
  it("finals resolve thắng/thua khi có round 7", () => {
    const finalRows: IMatch[] = [
      ...semiRows,
      { id: "R7-1", round: 7, court: 1, time: "", a: 1, b: 2, sa: 0, sb: 0, state: "next" },
      { id: "R7-2", round: 7, court: 2, time: "", a: 4, b: 3, sa: 0, sb: 0, state: "next" },
    ];
    const semis = computeSemis([], finalRows, TEAMS);
    const { final, third } = computeFinals(semis, finalRows, TEAMS);
    expect(final).toMatchObject({ aTeamId: 1, bTeamId: 2 });
    expect(third).toMatchObject({ aTeamId: 4, bTeamId: 3 });
  });
  it("giữ placeholder khi chưa có round 6/7", () => {
    const semis = computeSemis([], [], TEAMS);
    expect(semis[0].aName).toBe("Hạt giống #1");
    const { final } = computeFinals(semis, [], TEAMS);
    expect(final.aName).toBe("Thắng Bán kết 1");
  });
});
```

- [ ] **Step 2: Chạy test đỏ**

Run: `npm run test -- standings`
Expected: FAIL — chữ ký cũ chỉ nhận 1 tham số.

- [ ] **Step 3: Cài đặt resolve**

Trong `standings.ts`:
```ts
function poWinner(m: IMatch): number | null {
  if (m.state !== "done") return null;
  return m.sa > m.sb ? m.a : m.sb > m.sa ? m.b : null;
}
function poLoser(m: IMatch): number | null {
  if (m.state !== "done") return null;
  return m.sa > m.sb ? m.b : m.sb > m.sa ? m.a : null;
}

export function computeSemis(seeds: ITeamChip[], matches: IMatch[], teams: ITeam[]): ISemiMatch[] {
  const byId = buildById(teams);
  const nameId = (id: number) => (byId.get(id) ? `${byId.get(id)!.letter} · ${byId.get(id)!.name}` : "");
  const fromRow = (m: IMatch, code: string): ISemiMatch => ({
    code,
    time: `${m.state === "done" ? "" : "11:30 · "}Sân ${m.court}`,
    aName: nameId(m.a),
    bName: nameId(m.b),
    aTeamId: m.a,
    bTeamId: m.b,
  });
  const bk1 = matches.find((m) => m.round === 6 && m.court === 1);
  const bk2 = matches.find((m) => m.round === 6 && m.court === 2);
  if (bk1 && bk2) return [fromRow(bk1, "BÁN KẾT 1"), fromRow(bk2, "BÁN KẾT 2")];

  // placeholder Plan A (seed-based)
  const name = (i: number) => (seeds[i] ? `${seeds[i].letter} · ${seeds[i].name}` : `Hạt giống #${i + 1}`);
  const tid = (i: number) => seeds[i]?.teamId ?? 0;
  return [
    { code: "BÁN KẾT 1", time: "11:30 · Sân 1", aName: name(0), bName: name(3), aTeamId: tid(0), bTeamId: tid(3) },
    { code: "BÁN KẾT 2", time: "11:30 · Sân 2", aName: name(1), bName: name(2), aTeamId: tid(1), bTeamId: tid(2) },
  ];
}

export function computeFinals(semis: ISemiMatch[], matches: IMatch[], teams: ITeam[]): { final: IFinalMatch; third: IFinalMatch } {
  const byId = buildById(teams);
  const nameId = (id: number) => (byId.get(id) ? `${byId.get(id)!.letter} · ${byId.get(id)!.name}` : "");
  const ck = matches.find((m) => m.round === 7 && m.court === 1);
  const h3 = matches.find((m) => m.round === 7 && m.court === 2);
  const final: IFinalMatch = ck
    ? { code: "CHUNG KẾT", time: "SÂN 1", aName: nameId(ck.a), bName: nameId(ck.b), aTeamId: ck.a, bTeamId: ck.b }
    : { code: "CHUNG KẾT", time: "SÂN 1", aName: "Thắng Bán kết 1", bName: "Thắng Bán kết 2", aTeamId: 0, bTeamId: 0 };
  const third: IFinalMatch = h3
    ? { code: "TRANH HẠNG 3", time: "SÂN 2", aName: nameId(h3.a), bName: nameId(h3.b), aTeamId: h3.a, bTeamId: h3.b }
    : { code: "TRANH HẠNG 3", time: "SÂN 2", aName: "Thua Bán kết 1", bName: "Thua Bán kết 2", aTeamId: 0, bTeamId: 0 };
  return { final, third };
}
```
> `poWinner/poLoser` để dành cho hiển thị tỉ số nếu cần mở rộng; giữ để lint không báo unused thì dùng trong test hoặc thêm score vào ISemiMatch (tuỳ chọn, ngoài scope tối thiểu).

- [ ] **Step 4: Cập nhật call site ScheduleBoard**

Trong `ScheduleBoard.tsx`:
```ts
const semis = computeSemis(seeds, matches, teams);
const { final, third } = computeFinals(semis, matches, teams);
```

- [ ] **Step 5: Chạy test xanh + build**

Run: `npm run test -- standings && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add lib/tournament/standings.ts app/schedule/ScheduleBoard.tsx lib/tournament/__tests__/standings.test.ts
git commit -m "feat(schedule): resolve semis/final/3rd from real playoff matches"
```

---

### Task 8: Seed/local `PLAYOFF_ROUND_META` + kiểm thử tay end-to-end

**Files:**
- Modify: `lib/tournament/data.ts` (thêm `PLAYOFF_ROUND_META`)
- Verify: chạy app local, mô phỏng đủ 4 đội qualified.

- [ ] **Step 1: Thêm meta local (đồng bộ với migration)**
```ts
export const PLAYOFF_ROUND_META: IRoundMeta[] = [
  { n: 6, title: "Bán kết", time: "11:30", sub: "Board 2 · 4 đội qualified" },
  { n: 7, title: "Chung kết / Hạng 3", time: "12:15", sub: "Board 2 · tranh cúp" },
];
```

- [ ] **Step 2: Kiểm thử tay (dùng skill `verify` hoặc `run`)**

- `supabase db reset` (local) → chèn kết quả để 4 đội đạt 3 thắng (qua referee UI hoặc SQL).
- Mở `/admin/referee`: xác nhận 2 bán kết tự xuất hiện, chọn & chấm điểm được.
- Chấm xong 2 bán kết → Chung kết + Hạng 3 tự xuất hiện với đúng đội thắng/thua.
- Mở `/schedule`: Board 2 hiện tên đội thật + placeholder đúng ở các bước chưa diễn ra.
- Chạy `reset_tournament()` → playoff bị dọn sạch, về trạng thái setup.

- [ ] **Step 3: Commit**
```bash
git add lib/tournament/data.ts
git commit -m "feat(playoffs): add playoff round meta for local/seed parity"
```

---

## Self-Review (Plan B)

- **Spec coverage:** trận playoff thật (Task 3-4), sinh tự động (Task 4-5), referee chấm (Task 6), resolve hiển thị (Task 7), seed/luật (Task 1-2-8). ✓
- **Vòng lặp import:** `standings.ts` KHÔNG import `playoffs.ts` (playoffs import standings) — resolve dùng `poWinner/poLoser` cục bộ trong standings. ✓ (Task 7 nhắc rõ.)
- **Chữ ký thay đổi giữa 2 plan:** `computeSemis(seeds)` (Plan A) → `computeSemis(seeds, matches, teams)` (Plan B) và call site ScheduleBoard cập nhật cùng task (Task 7). ✓
- **RLS/an toàn giữa giải:** migration chỉ INSERT `rounds` meta; không đổi policy; reset đã bao phủ. ✓
- **Idempotency:** `generateSemis/generateFinals` trả null khi round đã tồn tại; `ensurePlayoffs` an toàn gọi lặp. ✓
- **Placeholder scan:** Task 6 Step 4 (nối state picker) và Task 3 test data cần người thực thi khớp theo code thật — đã ghi chú rõ, không phải TODO logic.
```
```
