import Link from "next/link";

const FEATURES = [
  { icon: "💬", title: "자연어 트레이딩", desc: '"ETH 가격 알려줘", "100 USDC를 ETH로 바꿔줘" — 채팅 한 줄이 전부다' },
  { icon: "📈", title: "Hyperliquid 퍼펫", desc: "채팅창에서 BTC 10배 롱. 실시간 mark로 평가" },
  { icon: "🚀", title: "토큰 런치패드", desc: "본딩커브 발행, 거래 수수료 1%가 에이전트 연료로 적립" },
  { icon: "🤖", title: "채널 봇", desc: "텔레그램·디스코드에서 멘션 한 번으로 응답하는 그룹 딜러" },
  { icon: "⌨️", title: "CLI + REST API", desc: "npm run cli, /api/v1/* — LLM 없이 직접 호출" },
  { icon: "⚡", title: "x402 유료 API", desc: "에이전트가 USDC로 자동 결제하는 열린 API — 호출당 0.01 USDC" },
];

export default function Landing() {
  return (
    <main className="landing">
      <nav className="nav">
        <span className="brand">agent-terminal</span>
        <span className="nav-links">
          <a href="/dashboard">대시보드</a>
          <Link href="/terminal" className="nav-cta">
            터미널 열기 →
          </Link>
        </span>
      </nav>

      <section className="hero">
        <p className="eyebrow">Bankr를 클론한 오픈 에이전트 트레이딩 플랫폼</p>
        <h1>
          지갑 연결 없이,
          <br />
          채팅 한 줄로 매수
        </h1>
        <p className="sub">
          그룹 채팅 안에 딜러를 고용했습니다. 시세·스왑·퍼펫·토큰 발행까지,
          <br />
          AI 에이전트가 자연어 명령으로 실행합니다.
        </p>
        <div className="cta-row">
          <Link href="/terminal" className="cta-primary">
            지금 데모 돌리기
          </Link>
          <a href="/report.html" className="cta-ghost">
            프로젝트 리포트
          </a>
        </div>
        <p className="hero-note">페이퍼 트레이딩 데모 · 실제 시세로 체결 · 온체인 서명 없음</p>
      </section>

      <section className="grid">
        {FEATURES.map((f) => (
          <div key={f.title} className="card">
            <span className="card-icon">{f.icon}</span>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>

      <section className="pricing">
        <h2>API 요금</h2>
        <div className="price-line">
          <span>$0.01</span> / 호출 — x402 프로토콜, USDC 자동결제 (base-sepolia)
        </div>
        <p className="pricing-note">
          사람이 결제 페이지를 누르는 게 아니라, 에이전트가 HTTP 402 응답을 보고 스스로 계산합니다.
        </p>
      </section>

      <footer className="footer">
        <p>페이퍼 트레이딩 데모입니다. 투자 조언이 아니며, 실서비스 전 관할 규제 검토가 필요합니다.</p>
      </footer>
    </main>
  );
}
