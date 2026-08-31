import Link from "next/link";

// 훅 원칙: 수익률을 약속하지 않는다.
// 파는 건 "얼마 번다"가 아니라 "무엇에 접근할 수 있고, 그걸 검증할 수 있다"이다.
// 펀딩 캐리 수익 주장은 70일 백테스트에서 마이너스로 나와 폐기했다 — 다시 쓰지 않는다.

const FEATURES = [
  {
    icon: "📈",
    title: "토큰화 주식·원자재 280종",
    desc: "NVDA · S&P500 · 금 · 브렌트유 · SK하이닉스 — HIP-3 빌더 시장까지 도달합니다. 대부분의 툴은 코어 177종만 봅니다.",
  },
  {
    icon: "✍️",
    title: "진짜 주문에 서명합니다",
    desc: "거래소가 우리 서명에서 서명자를 복원하는 것까지 확인했습니다. 페이퍼 데모가 아니라 실제 주문 경로입니다.",
  },
  {
    icon: "🔍",
    title: "수수료를 코드로 확인",
    desc: "거래액의 0.1%(builder fee) 하나. 구독료도 토큰도 없습니다. 직접 읽고 검증할 수 있습니다.",
  },
  {
    icon: "🔑",
    title: "키는 내 서버에",
    desc: "셀프호스트. 유저 지갑은 주문만 가능하고 출금 권한이 구조적으로 없는 HL agent 지갑입니다.",
  },
  {
    icon: "💬",
    title: "채팅 · 텔레그램 · 디스코드 · CLI",
    desc: "같은 엔진을 다섯 표면에서. REST API도 열려 있어 LLM 없이 직접 부를 수 있습니다.",
  },
  {
    icon: "🛡️",
    title: "안전장치가 기본값",
    desc: "기본은 PAPER 모드. 키가 있다는 이유만으로 실주문이 나가지 않습니다. 레버리지 상한·최소 주문액·출금 경로 부재.",
  },
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
        <p className="eyebrow">오픈소스 · Hyperliquid 거래 에이전트</p>
        <h1>
          채팅으로 엔비디아를
          <br />
          온체인에서 산다
        </h1>
        <p className="sub">
          Hyperliquid의 HIP-3 시장에는 토큰화된 주식·지수·원자재가 올라와 있습니다.
          <br />
          이 에이전트는 그 <b>280종에 도달</b>하고, <b>진짜 주문에 서명</b>합니다. 코드는 공개돼 있습니다.
        </p>
        <div className="cta-row">
          <Link href="/terminal" className="cta-primary">
            터미널 열어보기
          </Link>
          <a href="https://github.com/bigrender/agent-terminal" className="cta-ghost">
            GitHub에서 코드 보기
          </a>
        </div>
        <p className="hero-note">
          공개 데모는 <b>읽기 전용</b>입니다 — 시세·자산 조회만 됩니다. 거래는 직접 호스팅해야 합니다.
        </p>
      </section>

      <section className="honesty">
        <h2>먼저 밝혀둘 것</h2>
        <ul>
          <li>
            <b>수익을 약속하지 않습니다.</b> 펀딩이 높은 시장을 잡는 캐리 전략을 70일치로 직접
            백테스트했더니 <b>마이너스</b>였습니다 — 무헤지 −5.65%, 두 시장을 반대로 잡는 델타
            중립도 −0.60%(승률 32%). HIP-3는 배포자마다 오라클이 달라 같은 자산이라도 가격이 함께
            움직이지 않습니다.
          </li>
          <li>
            <b>이건 거래 도구지 전략이 아닙니다.</b> 무엇을 살지는 본인이 정하고, 우리는 그 주문이
            정확히 나가게 하는 부분을 맡습니다.
          </li>
          <li>
            <b>레버리지는 원금을 넘어 잃게 만듭니다.</b> HIP-3 시장은 2026년 7월 오라클 이상값 한
            건으로 19% 급락해 960여 계좌가 청산된 전례가 있습니다.
          </li>
        </ul>
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
        <h2>어떻게 돈을 버나</h2>
        <div className="price-line">
          <span>0.1%</span> — 거래액의 builder fee. 그게 전부입니다.
        </div>
        <p className="pricing-note">
          구독료 없음, 토큰 없음, 선불 없음. 거래가 없으면 0.1% × 0 = $0입니다. 수수료는 주문에 붙어
          온체인에 쌓이고, 요율은 코드에서 확인할 수 있습니다.
        </p>
      </section>

      <footer className="footer">
        <p>
          투자 조언이 아닙니다. 파생상품 거래는 원금 전액을 잃을 수 있습니다. 거래 수수료를 받으며
          특정 관할의 개인투자자를 유치하는 것은 그 나라의 무인가 금융투자업에 해당할 수 있으니,
          이용자를 정하기 전에 규제 전문가와 확인하세요.
        </p>
      </footer>
    </main>
  );
}
