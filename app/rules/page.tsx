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
  return (
    <div
      style={{
        marginTop: n === 1 ? 28 : 16,
        background: "#FFFDF7",
        border: "1px solid rgba(10,31,26,.12)",
        borderRadius: 22,
        padding: "clamp(22px,3vw,32px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "#0B5D4E",
            color: "#FFFDF7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {n}
        </span>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-.02em" }}>{title}</h3>
      </div>
      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        {rules.map((rule, i) => (
          <div key={i} style={{ display: "flex", gap: 12 }}>
            <span
              style={{
                fontFamily: "var(--font-jetbrains), monospace",
                fontSize: 12,
                color: "#8AA39C",
                flex: "none",
                width: 20,
              }}
            >
              {i + 1}
            </span>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>{rule}</div>
          </div>
        ))}
      </div>
      {n === 2 && (
        <div
          style={{
            marginTop: 18,
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 11,
            color: "#8AA39C",
          }}
        >
          TRỌNG TÀI CÓ QUYỀN QUYẾT ĐỊNH CUỐI CÙNG TRONG MỌI TÌNH HUỐNG TRANH CHẤP.
        </div>
      )}
    </div>
  );
}

export default function RulesPage() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "34px 20px 60px" }}>
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-bricolage), Archivo, sans-serif",
          fontSize: "clamp(30px,4.6vw,52px)",
          fontWeight: 900,
          letterSpacing: "-.035em",
        }}
      >
        Quy tắc thi đấu
      </h2>
      <p style={{ margin: "10px 0 0", maxWidth: 640, fontSize: 15, lineHeight: 1.6, color: "#3C5A53" }}>
        Hai phần: thể thức giải (Swiss-system) và luật đánh cầu lông đôi tiêu chuẩn.
      </p>

      <RuleSection n={1} title="Thể thức Swiss-system" rules={SWISS_RULES} />
      <RuleSection n={2} title="Luật đánh cầu lông đôi" rules={DOUBLES_RULES} />
    </div>
  );
}
