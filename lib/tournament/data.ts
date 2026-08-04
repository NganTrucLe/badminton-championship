/**
 * Seed data ported verbatim from the approved design prototype at
 * `.design-reference/Giai Cau Long CLB.dc.html` (the inline `<script type="text/x-dc">`
 * block: AVATAR_COLORS, hashStr, TIER, TEAMS, MATCHES, ROUND_META).
 *
 * This is Phase 1 local mock data — no backend yet. Phase 2 will replace this module's
 * consumers with Supabase reads, seeded with this exact same data so first render matches.
 */

export type TTier = 1 | 2 | 3 | 4;

export type TMatchState = "next" | "live" | "done";

export interface IPlayer {
  name: string;
  tier: TTier;
  /**
   * Base filename (no extension) for the player's photo, resolved to
   * `/avatars/{avatarKey}.jpg`. Undefined means no photo — components must
   * fall back to a colored initials avatar (see lib/tournament/avatar.ts).
   */
  avatarKey?: string;
  /** Full public URL of an uploaded avatar (Supabase Storage). Takes precedence over avatarKey. */
  avatarUrl?: string;
}

export interface ITeam {
  id: number;
  letter: string;
  name: string;
  players: [IPlayer, IPlayer];
}

export interface IMatch {
  id: string;
  round: number;
  court: number;
  time: string;
  /** Team id of side A */
  a: number;
  /** Team id of side B */
  b: number;
  sa: number;
  sb: number;
  state: TMatchState;
}

export interface IRoundMeta {
  n: number;
  title: string;
  time: string;
  sub: string;
}

export interface ITierMeta {
  color: string;
  fg: string;
  label: string;
}

/** Deterministic fallback avatar colors, keyed by hashStr(playerName) % length. */
export const AVATAR_COLORS: readonly string[] = [
  "#E0724A",
  "#3F7CB0",
  "#B0553F",
  "#4E8A6E",
  "#8A5FB0",
  "#C99A2E",
  "#4A7E9E",
  "#B0435F",
];

/**
 * Simple deterministic string hash (ported verbatim from the design). Used to pick a
 * stable fallback avatar color per player name — same algorithm as the source `.dc.html`
 * so colors match the original design exactly.
 */
export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

export const TIER: Record<TTier, ITierMeta> = {
  1: { color: "#0B5D4E", fg: "#FFFDF7", label: "Bậc 1" },
  2: { color: "#3FBF8F", fg: "#052D22", label: "Bậc 2" },
  3: { color: "#F2B544", fg: "#08241E", label: "Bậc 3" },
  4: { color: "#E4DFCE", fg: "#3C5A53", label: "Bậc 4" },
};

export const TEAMS: ITeam[] = [
  {
    id: 1,
    letter: "A",
    name: "Trung – Kiên",
    players: [
      { name: "Trung", tier: 1, avatarKey: "trung-avatar" },
      { name: "Kiên", tier: 4 },
    ],
  },
  {
    id: 2,
    letter: "B",
    name: "Minh Anh – Bình",
    players: [
      { name: "Minh Anh", tier: 2, avatarKey: "minhanh-avatar" },
      { name: "Bình", tier: 3 },
    ],
  },
  {
    id: 3,
    letter: "C",
    name: "Vinh – Trúc",
    players: [
      { name: "Vinh", tier: 2, avatarKey: "vinh-avatar" },
      { name: "Trúc", tier: 3, avatarKey: "truc-avatar" },
    ],
  },
  {
    id: 4,
    letter: "D",
    name: "Vũ – Quang Hào",
    players: [
      { name: "Vũ", tier: 2 },
      { name: "Quang Hào", tier: 3, avatarKey: "hao-avatar" },
    ],
  },
  {
    id: 5,
    letter: "E",
    name: "Duy – Huy Nguyễn",
    players: [
      { name: "Duy", tier: 1, avatarKey: "duy-avatar" },
      { name: "Huy Nguyễn", tier: 4 },
    ],
  },
  {
    id: 6,
    letter: "F",
    name: "Tùng – Mỹ Hồ",
    players: [
      { name: "Tùng", tier: 1, avatarKey: "tung-avatar" },
      { name: "Mỹ Hồ", tier: 4, avatarKey: "myho-avatar" },
    ],
  },
  {
    id: 7,
    letter: "G",
    name: "Nhân – Gái",
    players: [
      { name: "Nhân", tier: 1, avatarKey: "nhan-avatar" },
      { name: "Gái", tier: 4, avatarKey: "gai-avatar" },
    ],
  },
  {
    id: 8,
    letter: "H",
    name: "Phát – Hùng Bùi",
    players: [
      { name: "Phát", tier: 2, avatarKey: "phat-avatar" },
      { name: "Hùng Bùi", tier: 3 },
    ],
  },
];

export const MATCHES: IMatch[] = [
  { id: "M1", round: 1, court: 1, time: "09:00", a: 1, b: 5, sa: 21, sb: 15, state: "done" },
  { id: "M2", round: 1, court: 2, time: "09:00", a: 2, b: 6, sa: 21, sb: 18, state: "done" },
  { id: "M3", round: 1, court: 1, time: "09:20", a: 3, b: 7, sa: 21, sb: 19, state: "done" },
  { id: "M4", round: 1, court: 2, time: "09:20", a: 4, b: 8, sa: 21, sb: 17, state: "done" },
  { id: "M5", round: 2, court: 1, time: "09:40", a: 1, b: 4, sa: 17, sb: 14, state: "live" },
  { id: "M6", round: 2, court: 2, time: "09:40", a: 2, b: 3, sa: 0, sb: 0, state: "next" },
  { id: "M7", round: 2, court: 1, time: "10:00", a: 5, b: 8, sa: 0, sb: 0, state: "next" },
  { id: "M8", round: 2, court: 2, time: "10:00", a: 6, b: 7, sa: 0, sb: 0, state: "next" },
];

export const ROUND_META: IRoundMeta[] = [
  { n: 1, title: "Round 1", time: "09:00 – 09:40", sub: "Ghép cặp mở màn" },
  { n: 2, title: "Round 2", time: "09:40 – 10:20", sub: "Ghép theo thành tích" },
  { n: 3, title: "Round 3", time: "10:20 – 10:50", sub: "Ghép theo thành tích" },
  { n: 4, title: "Round 4", time: "10:50 – 11:10", sub: "Có trận đấu chéo" },
  { n: 5, title: "Round 5", time: "11:10 – 11:25", sub: "Chốt suất cuối" },
];

/** 1 -> 'A', 2 -> 'B', ... 8 -> 'H'. Inverse of the letter->id mapping in lib/supabase/tournament.ts. */
export function teamIdToLetter(id: number): string {
  return String.fromCharCode(64 + id);
}

export function getTeam(id: number): ITeam {
  const team = TEAMS.find((t) => t.id === id);
  if (!team) {
    throw new Error(`Unknown team id: ${id}`);
  }
  return team;
}

export function teamName(id: number): string {
  return getTeam(id).name;
}

export function teamPlayersLabel(id: number): string {
  return getTeam(id)
    .players.map((p) => p.name)
    .join(" & ");
}

/** Resolves a player's avatar photo path, or undefined when there is no photo. */
export function avatarPhotoPath(player: IPlayer): string | undefined {
  if (player.avatarUrl) return player.avatarUrl;
  return player.avatarKey ? `/avatars/${player.avatarKey}.jpg` : undefined;
}

/** Deterministic fallback color for a player's initials avatar. */
export function avatarFallbackColor(playerName: string): string {
  return AVATAR_COLORS[Math.abs(hashStr(playerName)) % AVATAR_COLORS.length];
}

/** Single-letter initial used by the Teams screen chip (e.g. duo avatars). */
export function playerInitial(playerName: string): string {
  return playerName.trim()[0]?.toUpperCase() ?? "";
}

/** Up-to-two-letter initials used by the Teams screen card (last name-ish words). */
export function playerInitials(playerName: string): string {
  return playerName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
