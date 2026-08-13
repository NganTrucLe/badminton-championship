# Spec: Placeholder & resolve cho Sơ đồ trận đấu (`/schedule`)

> Trạng thái: **DRAFT — chờ duyệt.** Đây là spec, chưa phải plan. Cần chốt các *Câu hỏi mở*
> trước khi tách thành các plan bite-sized trong `.planning/plans/`.

## Problem — đang đau ở đâu

Sơ đồ trận đấu trên `/schedule` (`app/schedule/ScheduleBoard.tsx` + `lib/tournament/standings.ts`)
chỉ hiển thị đầy đủ cặp đấu khi vòng trước đã có kết quả. Người xem không thấy trước "trận kế là ai
gặp ai". Cụ thể 3 chỗ:

1. **Board 1 · Swiss — các vòng sau (R2–R5).** Khi vòng trước chưa xong, cột vòng sau hiện một ô
   rỗng `"CHỜ VÒNG TRƯỚC · Ghép cặp khi có đủ kết quả"` (`computeSwissColumns`,
   `standings.ts:383-393`). Không gợi ý gì về cấu trúc sắp tới.
2. **Board 2 · Bán kết.** Đã có placeholder `Hạt giống #1 … #4` khi chưa đủ 4 đội qualified
   (`computeSemis`, `standings.ts:410-416`), rồi hiện tên thật khi đủ. Cần rà lại cách hiển thị/thứ
   tự seed.
3. **Board 2 · Chung kết + Tranh hạng 3.** Hiện là **text tĩnh hardcode** trong JSX
   (`ScheduleBoard.tsx:268-281`): "Thắng Bán kết 1 / Thắng Bán kết 2", "Thua Bán kết 1 / Thua Bán
   kết 2". **Không bao giờ resolve ra tên đội thật** vì trong data model không tồn tại trận bán
   kết/chung kết thật (chỉ có Swiss round 1–5 trong bảng `matches`); semis được "bịa" từ danh sách
   qualified nên không có tỉ số để biết ai thắng.

**Quyết định của chủ sản phẩm (đã chốt qua hỏi-đáp):** làm cả 3 phần, VÀ **thêm trận playoff thật**
để Chung kết/Hạng 3 tự resolve đội thắng/thua.

## Ràng buộc kiến trúc hiện tại (đã khảo sát)

- `matches` (Supabase) có `round_n`, `court`, `pair_a_id`, `pair_b_id`, `score_a/b`, `state`
  (`next|live|done`); RLS chỉ cho organizer update điểm khi `tournament.status='live'`.
- Swiss auto-sinh vòng kế qua Server Action `ensureNextRound()` + `generateNextRound()`
  (`lib/tournament/swissPairing.ts`) — pattern để mô phỏng cho playoff.
- `computeQualified` trả về đội theo **thứ tự team id, chưa rank** — chưa có tiebreaker để seed.
- `computeStandingsTable` sort `w` giảm dần rồi `id` — **không có point-diff/head-to-head**.
- Referee chấm điểm trên các match row có `state` (`RefereeScoringPanel`); nếu playoff là match
  row thật, nó chảy qua referee UI sẵn có — nhưng picker/`ensureNextRound` có thể cần biết về vòng
  playoff.
- `ScheduleBoard` là client island, tính lại toàn bộ từ `standings.ts` mỗi khi `useLiveMatches`
  (Supabase Realtime) đổi — thêm view mới chỉ cần thêm hàm pure trong `standings.ts`.

## Proposed solution — chia 2 giai đoạn (đề xuất tách 2 plan)

### Plan A — Placeholder FE thuần (KHÔNG đụng backend) · nhỏ, ship trước
Mục tiêu: mọi vòng luôn cho thấy "cấu trúc sắp tới" thay vì ô rỗng, không cần data mới.

- **Board 1 Swiss (R2–R5):** thay ô "CHỜ VÒNG TRƯỚC" bằng các **nhóm thành tích dự kiến** sẽ hình
  thành (`Nhóm 2–0`, `Nhóm 1–1`, `Nhóm 0–2` …) với slot placeholder "chờ đội" — vì luật Swiss ghép
  theo thành tích nên KHÔNG thể nói "thắng trận X" như nhánh loại; đây là biểu diễn trung thực nhất.
- **Board 2 Bán kết:** giữ placeholder seed nhưng seed theo **bảng xếp hạng thật** (xem Câu hỏi mở
  #2) và nhãn rõ ràng "Nhất bảng / Nhì bảng…" hoặc "Hạt giống #n".
- **Board 2 Chung kết/Hạng 3:** đổi text tĩnh → dữ liệu từ `computeSemis`, hiển thị placeholder
  "Thắng BK1 / Thắng BK2", "Thua BK1 / Thua BK2" (vẫn placeholder vì chưa có trận thật ở Plan A).

Chỉ đụng: `lib/tournament/standings.ts`, `app/schedule/ScheduleBoard.tsx`, tests trong
`lib/tournament/__tests__` + `app/schedule/__tests__`.

### Plan B — Trận playoff thật + resolve (full-stack) · lớn
Mục tiêu: khi bán kết đấu xong, Chung kết tự điền đội thắng, Tranh hạng 3 tự điền đội thua.

- **Schema/data:** thêm các row playoff vào `matches` (đề xuất `round_n` = 6 bán kết, 7 chung
  kết + hạng 3) + `rounds` meta; cần cách **liên kết trận kế → nguồn** (final lấy winner của 2 semi;
  3rd lấy loser) — xem Câu hỏi mở #4.
- **Sinh trận:** Server Action `ensurePlayoffs()` kiểu `ensureNextRound` — tạo 2 bán kết khi đủ 4
  qualified (seed theo #2); tạo Chung kết + Hạng 3 khi cả 2 bán kết `done`.
- **Referee:** cho phép chấm điểm vòng playoff (picker/gate nhận `round_n` 6–7).
- **FE resolve:** `computeSemis`/`computeFinals` đọc match row thật; placeholder khi chưa có, tên
  thật + tỉ số khi có.
- Đụng: migration mới, `swissPairing`/pairing playoff, `ensurePlayoffs.ts`, referee panel/controls,
  `standings.ts`, `ScheduleBoard.tsx`, `data.ts`, seed, tests.

## Out of scope
- Không đổi luật Swiss hay công thức tính qualified/eliminated (3 thắng / 3 thua).
- Không làm bảng xếp hạng chi tiết mới ngoài tiebreaker cần cho seeding.
- Không thêm real-time cho gì ngoài `matches` (đã có).

## Trade-offs / rủi ro
- **Swiss không thể "winner match X vs winner match Y".** Ghép theo thành tích ⇒ placeholder chỉ
  là nhóm thành tích, không phải cặp đội cụ thể. Nếu kỳ vọng là nhánh loại thì sẽ lệch mong đợi.
- **Plan B chạm RLS + referee + migration** ⇒ blast radius lớn, cần test kỹ trên Postgres local.
- **Seeding cần tiebreaker rõ ràng**, nếu không thứ tự Chung kết sẽ tùy tiện/không ổn định.
- **Sự kiện đang diễn ra hôm nay (2026-08-13, R2 đang live).** Migration/RLS đổi giữa giải là rủi
  ro — cân nhắc ship Plan A trước, Plan B sau giải hoặc trong cửa sổ an toàn.

## Câu hỏi mở (cần chốt trước khi viết plan)
1. **Swiss placeholder:** OK với biểu diễn "nhóm thành tích dự kiến (Nhóm 2–0 / 1–1 / 0–2) + slot
   chờ" thay vì cặp đội cụ thể? (Đúng bản chất Swiss.)
2. **Seeding bán kết:** thứ tự 4 đội qualified để xếp seed1..4 tính theo gì? (a) số trận thắng →
   hiệu số điểm → head-to-head; (b) thứ tự về đích (ai đủ 3 thắng trước xếp trên); (c) khác.
3. **Trigger sinh trận playoff:** tự động (như `ensureNextRound`, gọi sau mỗi trận kết thúc) hay
   nút bấm ở `/admin`?
4. **Cách liên kết Final/3rd → semi nguồn:** (a) quy ước theo `round_n`+`court` cố định; (b) thêm
   cột `source_a_match`, `source_b_match`/`source_slot` (winner|loser) vào `matches`. (b) tường minh
   hơn nhưng cần migration nặng hơn.
5. **Thứ tự ship:** làm Plan A trước (ship nhanh, an toàn giữa giải) rồi Plan B? Hay gộp 1 lần?

## Đề xuất
Duyệt spec + trả lời Câu hỏi mở, sau đó tôi tách thành **2 plan riêng** (A nhỏ FE-only trước, B
full-stack sau) theo đúng writing-plans scope-check (mỗi plan tự ship được, tự test được). Không
gộp vào 1 plan vì 2 khối rủi ro/hệ thống rất khác nhau.
