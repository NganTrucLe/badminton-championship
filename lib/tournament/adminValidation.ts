import type { TTier } from "@/lib/tournament/data";

export function validatePlayerName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Tên không được để trống.";
  if (trimmed.length > 40) return "Tên quá dài (tối đa 40 ký tự).";
  return null;
}

export function validateTier(tier: number): tier is TTier {
  return tier === 1 || tier === 2 || tier === 3 || tier === 4;
}

export function validatePairAssignment(player1Id: string, player2Id: string): string | null {
  if (!player1Id || !player2Id) return "Hãy chọn đủ 2 người cho mỗi cặp.";
  if (player1Id === player2Id) return "Hai người trong một cặp phải khác nhau.";
  return null;
}

export function validateRosterComplete(
  pairs: { player1Id: string; player2Id: string }[],
  playerCount: number,
): string | null {
  if (pairs.length !== 8) return "Cần đúng 8 cặp đấu.";
  for (const p of pairs) {
    const err = validatePairAssignment(p.player1Id, p.player2Id);
    if (err) return err;
  }
  if (playerCount !== 16) return "Cần đúng 16 vận động viên.";
  return null;
}
