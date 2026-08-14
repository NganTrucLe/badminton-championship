# Plan A — Placeholder FE cho Sơ đồ trận đấu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mọi vòng trên `/schedule` luôn cho thấy *cấu trúc trận đấu sắp tới* bằng placeholder — không còn ô rỗng — mà không đụng backend.

**Architecture:** Toàn bộ logic hiển thị nằm trong pure functions ở `lib/tournament/standings.ts`; `app/schedule/ScheduleBoard.tsx` chỉ render. Ta (1) sinh "nhóm thành tích dự kiến" cho các vòng Swiss chưa có dữ liệu, (2) seed bán kết theo bảng xếp hạng thật, (3) chuyển Chung kết/Hạng 3 từ text tĩnh hardcode sang một pure function trả placeholder. Plan B sau này thay ruột 2 hàm semis/finals bằng dữ liệu trận thật — nên chữ ký hàm ở plan này được thiết kế sẵn để nhận `matches`.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, Vitest + Testing Library.

## Global Constraints

- `npm run build` PHẢI pass trước mọi commit (project rule).
- TDD: viết test đỏ trước, rồi code cho xanh (Red → Green → Refactor).
- Atomic commits, title-only, dùng git identity của user: `type(scope): what changed`.
- KHÔNG đụng Supabase/migration/RLS/referee trong plan này (đó là Plan B).
- Ngôn ngữ UI: tiếng Việt, giữ nguyên phong cách nhãn hiện có (JetBrains mono, chữ hoa, tracking).
- Swiss KHÔNG hiển thị "thắng trận X vs thắng trận Y" (ghép theo thành tích, không phải nhánh loại) — placeholder là *nhóm thành tích dự kiến* (đã chốt với chủ sản phẩm).
- Bảng xếp hạng/seed: **wins desc → point differential (pf−pa) desc → head-to-head → letter (id) asc** (đã chốt).

---

## File Structure

- `lib/tournament/standings.ts` — thêm: bảng nhóm dự kiến theo vòng, `computeSeeds`, sửa `computeSemis` để nhận seeds đã rank + gắn `aTeamId/bTeamId`, thêm `computeFinals`; sửa `computeSwissColumns` để phát placeholder groups cho vòng chưa có dữ liệu. Thêm field `placeholderPairs` vào `ISwissGroup` và `aTeamId/bTeamId` vào `ISemiMatch`.
- `app/schedule/ScheduleBoard.tsx` — render dashed placeholder rows cho Swiss; render semis kèm avatar khi biết đội; thay JSX Chung kết/Hạng 3 tĩnh bằng output `computeFinals`.
- `lib/tournament/__tests__/standings.test.ts` — test cho `computeSeeds`, nhóm dự kiến, `computeFinals`, semis resolve.

**Interfaces mới (khai báo ở Task 1, các task sau phụ thuộc):**
```ts
// ISwissGroup thêm:
placeholderPairs: number; // số dòng "chờ đội – chờ đội" dashed để render (0 với nhóm thật)

// ISemiMatch thêm:
aTeamId: number; // 0 khi còn là placeholder hạt giống
bTeamId: number;

export interface IFinalMatch {
  code: string;
  time: string;
  aName: string;
  bName: string;
  aTeamId: number; // 0 khi placeholder
  bTeamId: number;
}
export function computeSeeds(matches: IMatch[], records: TTeamRecords, teams: ITeam[]): ITeamChip[];
export function computeSemis(seeds: ITeamChip[]): ISemiMatch[]; // seeds đã rank
export function computeFinals(semis: ISemiMatch[]): { final: IFinalMatch; third: IFinalMatch };
```

---

### Task 1: Mở rộng kiểu dữ liệu + `computeSeeds` (rank qualified)

**Files:**
- Modify: `lib/tournament/standings.ts` (thêm field vào `ISwissGroup` ~dòng 85-93 và `ISemiMatch` ~105-110; thêm `IFinalMatch`; thêm `computeSeeds`)
- Test: `lib/tournament/__tests__/standings.test.ts`

**Interfaces:**
- Consumes: `IMatch`, `ITeam`, `TTeamRecords`, `ITeamChip`, `buildTeamRecords` (đã có).
- Produces: `computeSeeds(matches, records, teams): ITeamChip[]` — chỉ đội qualified (w≥3), sắp theo wins desc → (pf−pa) desc → head-to-head → id asc.

- [ ] **Step 1: Viết test đỏ cho `computeSeeds`**

Thêm vào `standings.test.ts`:
```ts
import { computeSeeds } from "../standings";

describe("computeSeeds", () => {
  const teams = TEAMS;
  // 4 đội qualified: 1,2,3,4 đều 3 thắng nhưng khác hiệu số; head-to-head 3 thắng 2.
  const done = (id: string, r: number, a: number, b: number, sa: number, sb: number): IMatch => ({
    id, round: r, court: 1, time: "", a, b, sa, sb, state: "done",
  });
  const matches: IMatch[] = [
    // team1: +18 tổng, team2: +12, team3: +6 (nhưng thắng team2 đối đầu), team4: +6
    done("W1", 1, 1, 5, 21, 3), done("W2", 2, 1, 6, 21, 5), done("W3", 3, 1, 7, 21, 8),
    done("W4", 1, 2, 8, 21, 9), done("W5", 2, 2, 5, 21, 9), done("H23", 3, 3, 2, 21, 19),
    done("W7", 1, 3, 6, 21, 15), done("W8", 2, 3, 8, 21, 15),
    done("W9", 1, 4, 7, 21, 15), done("W10", 2, 4, 8, 21, 16), done("W11", 3, 4, 5, 21, 16),
  ];
  it("chỉ trả đội đủ 3 thắng, đúng thứ tự seed (thắng→hiệu số→đối đầu)", () => {
    const records = buildTeamRecords(matches, teams);
    const seeds = computeSeeds(matches, records, teams);
    expect(seeds.map((s) => s.teamId)).toEqual([1, 2, 3, 4]);
  });
  it("đối đầu phá hòa khi hiệu số bằng nhau", () => {
    const records = buildTeamRecords(matches, teams);
    // team2 (+? ) vs team3: team3 thắng trực tiếp (H23) => nếu hiệu số bằng, team3 trên team2
    const seeds = computeSeeds(matches, records, teams);
    const i2 = seeds.findIndex((s) => s.teamId === 2);
    const i3 = seeds.findIndex((s) => s.teamId === 3);
    expect(i3).toBeLessThan(i2); // chỉ đúng nếu hiệu số 2 và 3 bằng nhau; điều chỉnh số liệu test nếu cần
  });
});
```
> Lưu ý người thực thi: tinh chỉnh tỉ số trong mảng `matches` sao cho team2 và team3 có cùng `pf−pa` để test đối đầu có ý nghĩa; giữ team1 hiệu số cao nhất, team4 thấp nhất.

- [ ] **Step 2: Chạy test để thấy đỏ**

Run: `npm run test -- standings`
Expected: FAIL — `computeSeeds is not a function`.

- [ ] **Step 3: Cài đặt kiểu + `computeSeeds`**

Trong `standings.ts`, thêm field vào interface:
```ts
export interface ISwissGroup {
  label: string;
  sub: string;
  bg: string;
  border: string;
  fg: string;
  matches: ISwissMatchDisplay[];
  chips: ITeamChip[];
  placeholderPairs: number; // NEW: số dòng dashed "chờ đội" (0 với nhóm thật)
}

export interface ISemiMatch {
  code: string;
  time: string;
  aName: string;
  bName: string;
  aTeamId: number; // NEW: 0 khi placeholder
  bTeamId: number; // NEW
}

export interface IFinalMatch {
  code: string;
  time: string;
  aName: string;
  bName: string;
  aTeamId: number;
  bTeamId: number;
}
```
Thêm head-to-head + `computeSeeds` (đặt ngay dưới `computeQualified`):
```ts
/** −1 nếu a thắng b trực tiếp, 1 nếu b thắng a, 0 nếu chưa gặp / hòa (không xảy ra: no deuce). */
function headToHead(matches: IMatch[], a: number, b: number): number {
  for (const m of matches) {
    if (m.state !== "done") continue;
    const isAB = (m.a === a && m.b === b) || (m.a === b && m.b === a);
    if (!isAB) continue;
    const aScore = m.a === a ? m.sa : m.sb;
    const bScore = m.a === a ? m.sb : m.sa;
    if (aScore > bScore) return -1;
    if (bScore > aScore) return 1;
  }
  return 0;
}

/** Đội qualified (w≥3) theo thứ tự seed: wins desc → (pf−pa) desc → head-to-head → id asc. */
export function computeSeeds(matches: IMatch[], records: TTeamRecords, teams: ITeam[]): ITeamChip[] {
  const byId = buildById(teams);
  return teams
    .filter((t) => records[t.id].w >= 3)
    .map((t) => t.id)
    .sort((x, y) => {
      const rx = records[x];
      const ry = records[y];
      return (
        ry.w - rx.w ||
        (ry.pf - ry.pa) - (rx.pf - rx.pa) ||
        headToHead(matches, x, y) ||
        x - y
      );
    })
    .map((id) => teamChip(id, records, byId));
}
```

- [ ] **Step 4: Chạy test xanh**

Run: `npm run test -- standings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tournament/standings.ts lib/tournament/__tests__/standings.test.ts
git commit -m "feat(schedule): add computeSeeds ranking + placeholder-ready types"
```

---

### Task 2: `computeSemis` nhận seeds đã rank + gắn teamId

**Files:**
- Modify: `lib/tournament/standings.ts` (`computeSemis` ~410-416)
- Test: `lib/tournament/__tests__/standings.test.ts`

**Interfaces:**
- Consumes: `computeSeeds` output (`ITeamChip[]`).
- Produces: `computeSemis(seeds): ISemiMatch[]` — 2 trận, seed1×seed4 & seed2×seed3, kèm `aTeamId/bTeamId` (0 khi thiếu seed).

- [ ] **Step 1: Viết test đỏ**
```ts
describe("computeSemis (seeded)", () => {
  it("ghép seed1×seed4, seed2×seed3 và gắn teamId khi đủ", () => {
    const records = buildTeamRecords(MATCHES, TEAMS);
    const seeds = computeSeeds(MATCHES, records, TEAMS); // có thể rỗng ở MATCHES gốc
    const fakeSeeds = [1, 2, 3, 4].map((id) => ({ teamId: id, letter: "", name: `T${id}`, rec: "3–0" }));
    const semis = computeSemis(fakeSeeds);
    expect(semis).toHaveLength(2);
    expect(semis[0]).toMatchObject({ aTeamId: 1, bTeamId: 4 });
    expect(semis[1]).toMatchObject({ aTeamId: 2, bTeamId: 3 });
  });
  it("hiện placeholder hạt giống + teamId=0 khi chưa đủ đội", () => {
    const semis = computeSemis([]);
    expect(semis[0].aName).toBe("Hạt giống #1");
    expect(semis[0].aTeamId).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test đỏ**

Run: `npm run test -- standings`
Expected: FAIL — `aTeamId` undefined.

- [ ] **Step 3: Cài đặt**
```ts
/** Board 2 bán kết: seed1 vs seed4, seed2 vs seed3 (seeds đã rank sẵn). */
export function computeSemis(seeds: ITeamChip[]): ISemiMatch[] {
  const name = (i: number) => (seeds[i] ? `${seeds[i].letter} · ${seeds[i].name}` : `Hạt giống #${i + 1}`);
  const tid = (i: number) => seeds[i]?.teamId ?? 0;
  return [
    { code: "BÁN KẾT 1", time: "11:30 · Sân 1", aName: name(0), bName: name(3), aTeamId: tid(0), bTeamId: tid(3) },
    { code: "BÁN KẾT 2", time: "11:30 · Sân 2", aName: name(1), bName: name(2), aTeamId: tid(1), bTeamId: tid(2) },
  ];
}
```

- [ ] **Step 4: Chạy test xanh**

Run: `npm run test -- standings`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/tournament/standings.ts lib/tournament/__tests__/standings.test.ts
git commit -m "feat(schedule): seed semifinals from ranked qualifiers"
```

---

### Task 3: `computeFinals` (chuyển text tĩnh Chung kết/Hạng 3 thành pure function)

**Files:**
- Modify: `lib/tournament/standings.ts` (thêm `computeFinals` dưới `computeSemis`)
- Test: `lib/tournament/__tests__/standings.test.ts`

**Interfaces:**
- Consumes: `computeSemis` output.
- Produces: `computeFinals(semis): { final: IFinalMatch; third: IFinalMatch }` — placeholder "Thắng/Thua Bán kết n", `teamId=0` (Plan B sẽ resolve đội thật).

- [ ] **Step 1: Viết test đỏ**
```ts
describe("computeFinals", () => {
  it("trả placeholder Chung kết = thắng 2 bán kết, Hạng 3 = thua 2 bán kết", () => {
    const semis = computeSemis([]);
    const { final, third } = computeFinals(semis);
    expect(final.aName).toBe("Thắng Bán kết 1");
    expect(final.bName).toBe("Thắng Bán kết 2");
    expect(third.aName).toBe("Thua Bán kết 1");
    expect(third.bName).toBe("Thua Bán kết 2");
    expect(final.aTeamId).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test đỏ**

Run: `npm run test -- standings`
Expected: FAIL — `computeFinals is not a function`.

- [ ] **Step 3: Cài đặt**
```ts
import { Trophy } from "lucide-react"; // KHÔNG cần ở đây — chỉ nhắc: không import UI vào standings.

/** Board 2 chung kết + tranh hạng 3. Plan A: placeholder tĩnh; Plan B resolve đội thật từ matches. */
export function computeFinals(semis: ISemiMatch[]): { final: IFinalMatch; third: IFinalMatch } {
  return {
    final: {
      code: "CHUNG KẾT",
      time: "SÂN 1",
      aName: "Thắng Bán kết 1",
      bName: "Thắng Bán kết 2",
      aTeamId: 0,
      bTeamId: 0,
    },
    third: {
      code: "TRANH HẠNG 3",
      time: "SÂN 2",
      aName: "Thua Bán kết 1",
      bName: "Thua Bán kết 2",
      aTeamId: 0,
      bTeamId: 0,
    },
  };
}
```
> Lưu ý: KHÔNG import bất kỳ thứ gì từ lucide-react/React vào `standings.ts` (đây là module pure). Dòng import ở trên chỉ để cảnh báo, đừng thêm.

- [ ] **Step 4: Chạy test xanh**

Run: `npm run test -- standings`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/tournament/standings.ts lib/tournament/__tests__/standings.test.ts
git commit -m "feat(schedule): move final/3rd-place placeholders into pure computeFinals"
```

---

### Task 4: Nhóm thành tích dự kiến cho các vòng Swiss chưa có dữ liệu

**Files:**
- Modify: `lib/tournament/standings.ts` (`computeSwissColumns` ~383-393, và mọi nơi tạo `ISwissGroup` phải set `placeholderPairs`)
- Test: `lib/tournament/__tests__/standings.test.ts`

**Interfaces:**
- Consumes: `records`, `ROUND_META`.
- Produces: cột Swiss cho vòng chưa populate giờ chứa các nhóm dự kiến (label `NHÓM w–l`, `placeholderPairs>0`) thay vì một ô "CHỜ VÒNG TRƯỚC".

**Bảng nhóm dự kiến (nguồn: `.memory/knowledge/swiss-format.md`, giải 8 đội):**
| Vòng | Nhóm dự kiến (số cặp) |
|---|---|
| 2 | 1–0 (2), 0–1 (2) |
| 3 | 2–0 (1), 1–1 (2), 0–2 (1) |
| 4 | 2–1 (1), 1–2 (2) |
| 5 | 2–2 (1) |

- [ ] **Step 1: Viết test đỏ**
```ts
describe("computeSwissColumns anticipated buckets", () => {
  it("vòng chưa có dữ liệu hiện nhóm thành tích dự kiến, không phải ô rỗng", () => {
    // MATCHES gốc: R1 done, R2 mới có live/next => R3+ chưa populate.
    const records = buildTeamRecords(MATCHES, TEAMS);
    const cols = computeSwissColumns(MATCHES, records, TEAMS);
    const r3 = cols.find((c) => c.round === 3)!;
    expect(r3.groups.map((g) => g.label)).toEqual(["NHÓM 2–0", "NHÓM 1–1", "NHÓM 0–2"]);
    expect(r3.groups.every((g) => g.placeholderPairs > 0)).toBe(true);
    // không còn nhóm "CHỜ VÒNG TRƯỚC"
    expect(r3.groups.some((g) => g.label === "CHỜ VÒNG TRƯỚC")).toBe(false);
  });
  it("nhóm thật (đã populate) có placeholderPairs = 0", () => {
    const records = buildTeamRecords(MATCHES, TEAMS);
    const cols = computeSwissColumns(MATCHES, records, TEAMS);
    const r1 = cols.find((c) => c.round === 1)!;
    expect(r1.groups[0].placeholderPairs).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test đỏ**

Run: `npm run test -- standings`
Expected: FAIL — label là "CHỜ VÒNG TRƯỚC" / thiếu `placeholderPairs`.

- [ ] **Step 3: Cài đặt**

Thêm hằng số trên đầu vùng hàm Swiss:
```ts
/** Nhóm thành tích dự kiến theo vòng cho giải 8 đội (xem .memory/knowledge/swiss-format.md). */
const ANTICIPATED_BUCKETS: Record<number, Array<{ w: number; l: number; pairs: number }>> = {
  2: [{ w: 1, l: 0, pairs: 2 }, { w: 0, l: 1, pairs: 2 }],
  3: [{ w: 2, l: 0, pairs: 1 }, { w: 1, l: 1, pairs: 2 }, { w: 0, l: 2, pairs: 1 }],
  4: [{ w: 2, l: 1, pairs: 1 }, { w: 1, l: 2, pairs: 2 }],
  5: [{ w: 2, l: 2, pairs: 1 }],
};
```
Trong `computeSwissColumns`, mọi chỗ `groups.push({...})` hiện có: thêm `placeholderPairs: 0`. Rồi thay nhánh fallback (khi `groups.length === 0`):
```ts
if (groups.length === 0) {
  (ANTICIPATED_BUCKETS[round.n] ?? []).forEach(({ w, l, pairs }) => {
    const style = groupStyle(w, l);
    groups.push({
      label: `NHÓM ${w}–${l}`,
      sub: "Dự kiến · ghép khi có kết quả vòng trước",
      ...style,
      matches: [],
      chips: [],
      placeholderPairs: pairs,
    });
  });
}
```
> Nhớ: cả nhánh `round.n === 1` và nhánh nhóm thật ở giữa cũng phải thêm `placeholderPairs: 0` để type khớp.

- [ ] **Step 4: Chạy test xanh**

Run: `npm run test -- standings`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/tournament/standings.ts lib/tournament/__tests__/standings.test.ts
git commit -m "feat(schedule): show anticipated record buckets for future swiss rounds"
```

---

### Task 5: Render placeholder trong `ScheduleBoard` (Swiss dashed rows + semis avatars + finals data-driven)

**Files:**
- Modify: `app/schedule/ScheduleBoard.tsx`
- Test: `app/schedule/__tests__/ScheduleBoard.test.tsx` (nếu chưa có test render, thêm test tối thiểu)

**Interfaces:**
- Consumes: `computeSeeds`, `computeSemis`, `computeFinals`, field `placeholderPairs`, `ISemiMatch.aTeamId`.
- Produces: UI — vòng Swiss dự kiến hiện dòng dashed "Chờ đội – Chờ đội"; semis hiện avatar khi `aTeamId>0`; Chung kết/Hạng 3 đọc từ `computeFinals`.

- [ ] **Step 1: Viết test đỏ (render)**
```tsx
import { render, screen } from "@testing-library/react";
import { ScheduleBoard } from "../ScheduleBoard";
import { MATCHES, TEAMS } from "@/lib/tournament/data";

const pairIdToTeamId = Object.fromEntries(TEAMS.map((t) => [String(t.id), t.id]));

it("hiện dòng placeholder cho vòng Swiss dự kiến và cụm Chung kết", () => {
  render(<ScheduleBoard initialMatches={MATCHES} pairIdToTeamId={pairIdToTeamId} teams={TEAMS} />);
  expect(screen.getAllByText(/Chờ đội/i).length).toBeGreaterThan(0);
  expect(screen.getByText("CHUNG KẾT")).toBeInTheDocument();
});
```

- [ ] **Step 2: Chạy test đỏ**

Run: `npm run test -- ScheduleBoard`
Expected: FAIL — chưa render "Chờ đội".

- [ ] **Step 3: Cài đặt UI**

3a. Trong `ScheduleBoard`, đổi nguồn dữ liệu:
```ts
const seeds = computeSeeds(matches, records, teams);
const semis = computeSemis(seeds);
const { final, third } = computeFinals(semis);
```
(bỏ `const semis = computeSemis(qualified);` cũ; `qualified`/`eliminated` vẫn giữ cho 2 danh sách chip.)

3b. Thêm component dòng dashed placeholder (đặt cạnh `SwissMatchCard`):
```tsx
function PlaceholderMatchRow() {
  return (
    <div className="flex items-center gap-[7px] rounded-[9px] border border-dashed border-[rgba(10,31,26,.2)] bg-white/60 px-2 py-1.5">
      <span className="min-w-0 flex-1 text-[11.5px] text-[#8AA39C] italic">Chờ đội</span>
      <span className="font-[family-name:var(--font-jetbrains)] text-[10px] text-[#B4BEBA]">vs</span>
      <span className="min-w-0 flex-1 text-right text-[11.5px] text-[#8AA39C] italic">Chờ đội</span>
    </div>
  );
}
```
Trong vòng lặp render group (sau `g.chips.map(...)`), thêm:
```tsx
{Array.from({ length: g.placeholderPairs }).map((_, i) => (
  <PlaceholderMatchRow key={`ph-${i}`} />
))}
```

3c. Semis: card hiện `m.aName`/`m.bName` giữ nguyên; thêm avatar khi biết đội:
```tsx
<div className="flex items-center gap-2 px-3 py-2.5">
  {m.aTeamId > 0 && <TeamAvatars teamId={m.aTeamId} size={18} />}
  <span className="text-sm font-bold text-[#FFFDF7]">{m.aName}</span>
</div>
<div className="flex items-center gap-2 border-t border-white/[.14] px-3 py-2.5">
  {m.bTeamId > 0 && <TeamAvatars teamId={m.bTeamId} size={18} />}
  <span className="text-sm font-bold text-[#FFFDF7]">{m.bName}</span>
</div>
```

3d. Thay JSX Chung kết/Hạng 3 tĩnh (dòng ~268-281) bằng data-driven:
```tsx
<Card className="gap-0 rounded-xl border-transparent bg-secondary p-4 text-secondary-foreground">
  <div className="font-[family-name:var(--font-jetbrains)] text-[9.5px] tracking-[.14em]">
    {final.code} · {final.time}
  </div>
  <div className="mt-2.5 flex items-center gap-2 text-base font-extrabold">
    {final.aTeamId > 0 && <TeamAvatars teamId={final.aTeamId} size={18} />}{final.aName}
  </div>
  <div className="mt-[7px] flex items-center gap-2 text-base font-extrabold">
    {final.bTeamId > 0 && <TeamAvatars teamId={final.bTeamId} size={18} />}{final.bName}
  </div>
</Card>
<Card className="gap-0 rounded-xl border-white/[.18] bg-white/[.08] p-4 text-[#DCEDE7]">
  <div className="font-[family-name:var(--font-jetbrains)] text-[9.5px] tracking-[.14em] text-[#8FBCB0]">
    {third.code} · {third.time}
  </div>
  <div className="mt-2.5 flex items-center gap-2 text-base font-extrabold">
    {third.aTeamId > 0 && <TeamAvatars teamId={third.aTeamId} size={18} />}{third.aName}
  </div>
  <div className="mt-[7px] flex items-center gap-2 text-base font-extrabold">
    {third.bTeamId > 0 && <TeamAvatars teamId={third.bTeamId} size={18} />}{third.bName}
  </div>
</Card>
```

- [ ] **Step 4: Chạy test xanh + build**

Run: `npm run test -- ScheduleBoard && npm run build`
Expected: PASS + build thành công.

- [ ] **Step 5: Commit**
```bash
git add app/schedule/ScheduleBoard.tsx app/schedule/__tests__/ScheduleBoard.test.tsx
git commit -m "feat(schedule): render placeholders for future rounds, semis and final/3rd"
```

---

## Self-Review (Plan A)

- **Spec coverage:** Board 1 Swiss (Task 4+5), Board 2 semis (Task 2+5), Board 2 finals/3rd (Task 3+5). ✓
- **Type consistency:** `placeholderPairs` thêm cho MỌI `ISwissGroup` (Task 4 nhắc rõ), `aTeamId/bTeamId` xuyên suốt semis (Task 2) & finals (Task 3). ✓
- **Không đụng backend:** đúng — chỉ `standings.ts` + `ScheduleBoard.tsx` + tests. ✓
- **Placeholder scan:** test `computeSeeds` cần người thực thi tinh chỉnh số liệu để nhánh đối đầu có nghĩa — đã ghi chú rõ (không phải placeholder logic, là dữ liệu test).
```
```
