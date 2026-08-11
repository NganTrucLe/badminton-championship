export interface IRoundOneMatch {
  code: string;
  court: number;
  time: string;
  aCode: string;
  bCode: string;
}

/**
 * Round-1 pairing for the badminton championship: 8 pairs sorted by code, paired adjacently
 * (A–B, C–D, E–F, G–H). Courts alternate 1/2 and times step 09:00 → 09:20, preserving the
 * original seed layout (supabase/seed.sql). Used by the "send đội hình" flow to regenerate
 * round 1 from the current roster.
 */
export function generateRoundOne(pairCodes: string[]): IRoundOneMatch[] {
  if (pairCodes.length !== 8) {
    throw new Error("round one requires exactly 8 pairs");
  }
  const codes = [...pairCodes].sort((a, b) => a.localeCompare(b));
  return [0, 1, 2, 3].map((i) => ({
    code: `M${i + 1}`,
    court: (i % 2) + 1,
    time: i < 2 ? "09:00" : "09:20",
    aCode: codes[i * 2],
    bCode: codes[i * 2 + 1],
  }));
}
