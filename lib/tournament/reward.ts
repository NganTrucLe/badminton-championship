export interface IReward {
  place: number;
  medal: string;
  title: string;
  detail: string;
}

export const DEFAULT_REWARDS: IReward[] = [
  { place: 1, medal: "🏆", title: "Cúp vô địch + phần thưởng chính", detail: "Sẽ công bố 🎉" },
  { place: 2, medal: "🥈", title: "Huy chương bạc + phần thưởng", detail: "Sẽ công bố 🎉" },
  { place: 3, medal: "🥉", title: "Huy chương đồng + phần thưởng", detail: "Sẽ công bố 🎉" },
];

function defaultFor(place: number): IReward {
  return DEFAULT_REWARDS.find((r) => r.place === place) ?? DEFAULT_REWARDS[0];
}

function normalizeOne(input: Partial<IReward> | undefined, place: number): IReward {
  const base = defaultFor(place);
  const src = input ?? {};
  return {
    place,
    medal: typeof src.medal === "string" && src.medal ? src.medal : base.medal,
    title: typeof src.title === "string" && src.title ? src.title : base.title,
    detail: typeof src.detail === "string" && src.detail ? src.detail : base.detail,
  };
}

export function parseRewards(raw: unknown): IReward[] {
  if (!Array.isArray(raw)) return DEFAULT_REWARDS;
  const byPlace = new Map<number, Partial<IReward>>();
  for (const item of raw) {
    if (item && typeof item === "object" && typeof (item as { place?: unknown }).place === "number") {
      byPlace.set((item as { place: number }).place, item as Partial<IReward>);
    }
  }
  return [1, 2, 3].map((place) => normalizeOne(byPlace.get(place), place));
}

export function mergeRewards(edits: Partial<IReward>[]): IReward[] {
  const byPlace = new Map<number, Partial<IReward>>();
  for (const e of edits) {
    if (typeof e.place === "number") byPlace.set(e.place, e);
  }
  return [1, 2, 3].map((place) => normalizeOne(byPlace.get(place), place));
}
