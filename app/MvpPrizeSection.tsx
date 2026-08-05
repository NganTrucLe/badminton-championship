import Link from "next/link";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMvpResults, getMvpStatus } from "@/lib/supabase/mvp";
import { isResultsVisible, type IMvpCandidate } from "@/lib/tournament/mvp";

// Declared outside MvpPrizeSection (not inline) to satisfy react-hooks/static-components — a
// component literal recreated on every render of its parent resets state each time.
function Winner({ title, winners }: { title: string; winners: IMvpCandidate[] }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <h3 className="font-[family-name:var(--font-bricolage)] text-lg">{title}</h3>
      {winners.length === 0 ? (
        <p className="text-muted-foreground">Chưa có kết quả</p>
      ) : (
        winners.map((c) => (
          <div key={c.id} className="flex flex-col items-center gap-1.5">
            <PlayerAvatar
              player={{
                name: c.name,
                tier: c.tier,
                avatarKey: c.avatarKey ?? undefined,
                avatarUrl: c.avatarUrl ?? undefined,
              }}
              size={72}
            />
            <strong>{c.name}</strong>
          </div>
        ))
      )}
    </div>
  );
}

// Prize blurb is always visible; the winners only reveal once the vote is closed (or its deadline
// has passed) per isResultsVisible — getMvpResults() is gated the same way server-side, but we
// avoid the call entirely while voting is still open.
export async function MvpPrizeSection() {
  const status = await getMvpStatus();
  const results = isResultsVisible(status.status) ? await getMvpResults() : null;

  return (
    <Card className="items-center gap-3 border-none bg-cream p-6 text-center">
      <h2 className="font-[family-name:var(--font-bricolage)] text-2xl text-primary">Giải MVP 🏸</h2>
      <p className="text-text-soft">
        Cầu thủ xuất sắc nhất (1 nam &amp; 1 nữ) do 16 vận động viên bình chọn. Phần thưởng:{" "}
        <strong>áo thể thao</strong>.
      </p>
      {results ? (
        <div className="mt-4 grid w-full grid-cols-2 gap-6">
          <Winner title="MVP Nam" winners={results.male.winners} />
          <Winner title="MVP Nữ" winners={results.female.winners} />
        </div>
      ) : status.status === "open" ? (
        <div className="mt-2 flex flex-col items-center gap-3">
          <p className="text-text-soft">Đang diễn ra bình chọn…</p>
          <Button asChild variant="success">
            <Link href="/vote">Bỏ phiếu ngay →</Link>
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
