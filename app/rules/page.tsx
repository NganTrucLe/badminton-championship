import { ListChecks, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/motion";

const SWISS_RULES: string[] = [
  "Mỗi trận đấu Bo1 — một ván duy nhất, chạm 21 điểm trước và cách biệt tối thiểu 2 điểm để thắng.",
  "Vòng 1: các đội được bốc thăm ghép cặp ngẫu nhiên.",
  "Từ vòng 2 trở đi: các đội có cùng số trận thắng–thua được ghép với nhau (ví dụ nhóm 1–0 đấu nội bộ, nhóm 0–1 đấu nội bộ). Ưu tiên tránh ghép lại đối thủ đã gặp.",
  "Thắng đủ 3 trận → Qualified, vào vòng playoffs. Thua đủ 3 trận → bị loại, dừng bước.",
  "Giải đấu tối đa 5 vòng. Khi một nhóm thành tích có số đội lẻ, một đội sẽ đấu chéo với đội cùng thành tích ở nhóm liền kề.",
  "4 đội qualified bước vào bán kết (hạt giống 1 gặp 4, hạt giống 2 gặp 3), sau đó chung kết và tranh hạng 3.",
];

const DOUBLES_RULES: string[] = [
  "Mỗi ván thắng đủ 21 điểm và cách biệt tối thiểu 2 điểm; tối đa 30 điểm (29–29 thì 30 điểm thắng).",
  "Tính điểm trực tiếp (rally point) — bên nào thắng pha cầu thì được điểm, bất kể bên nào giao cầu.",
  "Giao cầu chéo sân; điểm số của đội giao cầu chẵn → giao từ ô bên phải, lẻ → giao từ ô bên trái.",
  "Chỉ người đứng đúng ô giao cầu mới được giao; sau khi giao, hai VĐV có thể di chuyển tự do trong sân của đội mình.",
  "Đội thắng pha cầu trước đó sẽ giao cầu ở ván tiếp theo (nếu là giao cầu đầu ván, đội thắng ván trước giao trước).",
  "Lỗi thường gặp: chạm lưới, cầu chạm người/áo, vợt hoặc người vượt qua lưới sang sân đối phương, giao cầu sai ô, cầu rơi ngoài biên.",
  "Đổi sân sau mỗi ván; ở ván quyết định, đổi sân khi một đội đạt 11 điểm.",
];

function RuleSection({ n, title, rules }: { n: number; title: string; rules: string[] }) {
  const Icon = n === 1 ? ListChecks : Users;

  return (
    <Card className={`${n === 1 ? "mt-7" : "mt-4"} rounded-[22px] border-border bg-card p-[clamp(22px,3vw,32px)]`}>
      <CardContent className="p-0">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary font-[family-name:var(--font-jetbrains)] text-[13px] font-bold text-primary-foreground">
            {n}
          </span>
          <Icon className="size-[18px] text-primary" aria-hidden="true" />
          <h3 className="m-0 text-xl font-black tracking-[-.02em]">{title}</h3>
        </div>
        <div className="mt-[18px] flex flex-col gap-[14px]">
          {rules.map((rule, i) => (
            <div key={i} className="flex gap-3">
              <span className="w-5 flex-none font-[family-name:var(--font-jetbrains)] text-xs text-text-faint">
                {i + 1}
              </span>
              <div className="text-sm leading-[1.6]">{rule}</div>
            </div>
          ))}
        </div>
        {n === 2 && (
          <div className="mt-[18px] font-[family-name:var(--font-jetbrains)] text-[11px] text-text-faint">
            TRỌNG TÀI CÓ QUYỀN QUYẾT ĐỊNH CUỐI CÙNG TRONG MỌI TÌNH HUỐNG TRANH CHẤP.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-5 pt-[34px] pb-[60px]">
      <h2 className="m-0 font-[family-name:var(--font-bricolage)] text-[clamp(30px,4.6vw,52px)] font-black tracking-[-.035em]">
        Quy tắc thi đấu
      </h2>
      <p className="mt-2.5 max-w-[640px] text-[15px] leading-[1.6] text-text-soft">
        Hai phần: thể thức giải (Swiss-system) và luật đánh cầu lông đôi tiêu chuẩn.
      </p>

      <Reveal delay={0}>
        <RuleSection n={1} title="Thể thức Swiss-system" rules={SWISS_RULES} />
      </Reveal>
      <Reveal delay={0.08}>
        <RuleSection n={2} title="Luật đánh cầu lông đôi" rules={DOUBLES_RULES} />
      </Reveal>
    </div>
  );
}
