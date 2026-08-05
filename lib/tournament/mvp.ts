import type { TTier } from "@/lib/tournament/data";

export type TGender = "male" | "female";
export type TMvpStatus = "idle" | "open" | "closed";

export interface IMvpCandidate {
  id: string;
  name: string;
  gender: TGender;
  tier: TTier;
  avatarKey: string | null;
  avatarUrl: string | null;
}

export interface IMvpBallotRow {
  gender: TGender;
  candidateId: string;
  votes: number;
}

export interface IMvpTally {
  candidate: IMvpCandidate;
  votes: number;
}

export interface IMvpGenderResult {
  gender: TGender;
  tallies: IMvpTally[];
  winners: IMvpCandidate[];
}

export interface IMvpResults {
  male: IMvpGenderResult;
  female: IMvpGenderResult;
}

export interface IMvpStatus {
  status: TMvpStatus;
  deadline: string | null;
  votedCount: number;
  totalEligible: number;
  isEligible: boolean;
  hasVoted: boolean;
}

export interface ISystemUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export function effectiveStatus(
  raw: TMvpStatus,
  deadline: string | null,
  now: Date,
): TMvpStatus {
  if (raw === "open" && (deadline === null || now.getTime() >= new Date(deadline).getTime())) {
    return "closed";
  }
  return raw;
}

export function isResultsVisible(status: TMvpStatus): boolean {
  return status === "closed";
}

export function groupCandidatesByGender(candidates: IMvpCandidate[]): {
  male: IMvpCandidate[];
  female: IMvpCandidate[];
} {
  return {
    male: candidates.filter((c) => c.gender === "male"),
    female: candidates.filter((c) => c.gender === "female"),
  };
}

export function computeWinners(tallies: IMvpTally[]): IMvpCandidate[] {
  const max = tallies.reduce((acc, t) => Math.max(acc, t.votes), 0);
  if (max === 0) return [];
  return tallies.filter((t) => t.votes === max).map((t) => t.candidate);
}

function buildGenderResult(
  gender: TGender,
  candidates: IMvpCandidate[],
  votesById: Map<string, number>,
): IMvpGenderResult {
  const tallies: IMvpTally[] = candidates
    .filter((c) => c.gender === gender)
    .map((candidate) => ({ candidate, votes: votesById.get(candidate.id) ?? 0 }))
    .sort((a, b) => b.votes - a.votes || a.candidate.name.localeCompare(b.candidate.name));
  return { gender, tallies, winners: computeWinners(tallies) };
}

export function tallyBallots(
  candidates: IMvpCandidate[],
  rows: IMvpBallotRow[],
): IMvpResults {
  const votesById = new Map<string, number>();
  for (const row of rows) votesById.set(row.candidateId, row.votes);
  return {
    male: buildGenderResult("male", candidates, votesById),
    female: buildGenderResult("female", candidates, votesById),
  };
}
