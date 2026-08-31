// 다국어 — 의존성 없이.
//
// next-intl 같은 걸 넣으면 라우팅이 /ko /en 으로 갈라지고 미들웨어가 붙는다.
// "더 심플하게" 가 목표라 사전 + 훅 하나로 끝낸다. 나중에 언어를 추가하려면
// DICT 에 키를 하나 더 넣으면 된다.

export const LANGS = ["ko", "en"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "en";

/**
 * 사전. 키는 `영역.항목` 형태로 짧게 유지한다.
 * 두 언어 모두 값을 채운다 — 빠지면 scripts/test-i18n.ts 가 잡는다.
 */
export const DICT = {
  // ── 공통 ──────────────────────────────────────────
  "nav.dashboard": { ko: "대시보드", en: "Dashboard" },
  "nav.terminal": { ko: "터미널 열기 →", en: "Open terminal →" },
  "nav.pricing": { ko: "요금", en: "Pricing" },
  "common.paper": { ko: "페이퍼", en: "Paper" },
  "common.live": { ko: "라이브", en: "Live" },
  "common.loading": { ko: "불러오는 중…", en: "Loading…" },
  "common.error": { ko: "오류", en: "Error" },

  // ── 랜딩: 히어로 ──────────────────────────────────
  "hero.eyebrow": {
    ko: "오픈소스 · Hyperliquid 거래 에이전트",
    en: "Open source · Hyperliquid trading agent",
  },
  "hero.title": {
    ko: "채팅으로 엔비디아를 온체인에서 산다",
    en: "Buy Nvidia on-chain, by chatting",
  },
  "hero.sub": {
    ko: "Hyperliquid HIP-3 시장에는 토큰화된 주식·지수·원자재가 올라와 있습니다. 이 에이전트는 그 280종에 도달하고, 진짜 주문에 서명합니다.",
    en: "Hyperliquid's HIP-3 markets list tokenized stocks, indices and commodities. This agent reaches all 280 of them and signs real orders.",
  },
  "hero.cta.try": { ko: "터미널 열어보기", en: "Open the terminal" },
  "hero.cta.code": { ko: "GitHub에서 코드 보기", en: "Read the code on GitHub" },
  "hero.note": {
    ko: "공개 데모는 읽기 전용입니다 — 시세·자산 조회만 됩니다. 거래는 직접 호스팅해야 합니다.",
    en: "The public demo is read-only — quotes and market data only. Trading requires self-hosting.",
  },

  // ── 랜딩: 라이브 티커 ─────────────────────────────
  "ticker.title": { ko: "지금 이 순간", en: "Right now" },
  "ticker.sub": {
    ko: "Hyperliquid 에서 직접 읽은 값입니다. 새로고침하면 바뀝니다.",
    en: "Read straight from Hyperliquid. Refresh and it moves.",
  },
  "ticker.assets": { ko: "거래 가능 자산", en: "tradable markets" },
  "ticker.hip3": { ko: "HIP-3 토큰화 자산", en: "HIP-3 tokenized" },
  "ticker.fee": { ko: "거래 수수료", en: "trading fee" },

  // ── 랜딩: 기능 ────────────────────────────────────
  "feat.assets.title": { ko: "토큰화 주식·원자재 280종", en: "280 tokenized markets" },
  "feat.assets.desc": {
    ko: "NVDA · S&P500 · 금 · 브렌트유 · SK하이닉스 — HIP-3 빌더 시장까지. 대부분의 툴은 코어 177종만 봅니다.",
    en: "NVDA · S&P500 · gold · Brent · SK Hynix — including HIP-3 builder markets. Most tools only see the core 177.",
  },
  "feat.sign.title": { ko: "진짜 주문에 서명합니다", en: "It signs real orders" },
  "feat.sign.desc": {
    ko: "거래소가 우리 서명에서 서명자를 복원하는 것까지 확인했습니다. 페이퍼 데모가 아닙니다.",
    en: "The exchange recovers our signer address from the signature — verified. Not a paper demo.",
  },
  "feat.fee.title": { ko: "수수료를 코드로 확인", en: "A fee you can read in the source" },
  "feat.fee.desc": {
    ko: "거래액의 0.1% 하나. 구독료도 토큰도 없습니다.",
    en: "0.1% of notional, and nothing else. No token, no mandatory subscription.",
  },
  "feat.keys.title": { ko: "키는 내 서버에", en: "Your keys, your server" },
  "feat.keys.desc": {
    ko: "셀프호스트. 유저 지갑은 주문만 가능하고 출금 권한이 구조적으로 없습니다.",
    en: "Self-hosted. User wallets can place orders but structurally cannot withdraw.",
  },
  "feat.surfaces.title": { ko: "채팅 · 텔레그램 · 디스코드 · CLI", en: "Chat · Telegram · Discord · CLI" },
  "feat.surfaces.desc": {
    ko: "같은 엔진을 다섯 표면에서. REST API 도 열려 있습니다.",
    en: "One engine, five surfaces. The REST API is open too.",
  },
  "feat.safety.title": { ko: "안전장치가 기본값", en: "Safe by default" },
  "feat.safety.desc": {
    ko: "기본은 PAPER. 키가 있다는 이유만으로 실주문이 나가지 않습니다.",
    en: "Paper mode by default. Having a key is not enough to send a live order.",
  },

  // ── 랜딩: 정직성 ──────────────────────────────────
  "honest.title": { ko: "먼저 밝혀둘 것", en: "Before you trade any of it" },
  "honest.noPromise": {
    ko: "수익을 약속하지 않습니다.",
    en: "We do not promise returns.",
  },
  "honest.backtest": {
    ko: "펀딩이 높은 시장을 잡는 캐리 전략을 70일치로 백테스트했더니 마이너스였습니다 — 무헤지 −5.65%, 델타 중립도 −0.60%(승률 32%). HIP-3 는 배포자마다 오라클이 달라 같은 자산이라도 가격이 함께 움직이지 않습니다.",
    en: "We backtested the carry trade over 70 days and it loses: −5.65% unhedged, −0.60% even paired across two venues (32% win rate). Each HIP-3 deployer runs its own oracle, so the two legs of the same asset do not move together.",
  },
  "honest.tool": {
    ko: "이건 거래 도구지 전략이 아닙니다. 무엇을 살지는 본인이 정합니다.",
    en: "This is a trading tool, not a strategy. What to buy is your call.",
  },
  "honest.leverage": {
    ko: "레버리지는 원금을 넘어 잃게 만듭니다. HIP-3 시장은 2026년 7월 오라클 이상값 한 건으로 19% 급락해 960여 계좌가 청산된 전례가 있습니다.",
    en: "Leverage can cost you more than you put in. In July 2026 a single bad oracle print dropped a HIP-3 market 19% and liquidated about 960 accounts.",
  },

  // ── 랜딩: 요금 ────────────────────────────────────
  "price.title": { ko: "어떻게 돈을 버나", en: "How this makes money" },
  "price.fee": { ko: "거래액의 builder fee. 그게 전부입니다.", en: "A builder fee on notional. That is the whole model." },
  "price.note": {
    ko: "구독료 없음, 토큰 없음, 선불 없음. 거래가 없으면 0.1% × 0 = $0 입니다.",
    en: "No token, no prepayment. If nobody trades, 0.1% × 0 = $0.",
  },
  "price.x402": { ko: "에이전트용 유료 API", en: "Paid API for agents" },
  "price.x402desc": {
    ko: "x402 규격. 사람이 결제 페이지를 누르는 게 아니라, 에이전트가 HTTP 402 를 보고 USDC 로 스스로 냅니다.",
    en: "x402. No checkout page — the calling agent sees HTTP 402 and settles in USDC by itself.",
  },
  "price.perCall": { ko: "호출당", en: "per call" },

  // ── 랜딩: 푸터 ────────────────────────────────────
  "footer.disclaimer": {
    ko: "투자 조언이 아닙니다. 파생상품 거래는 원금 전액을 잃을 수 있습니다. 거래 수수료를 받으며 특정 관할의 개인투자자를 유치하는 것은 그 나라의 무인가 금융투자업에 해당할 수 있으니, 이용자를 정하기 전에 규제 전문가와 확인하세요.",
    en: "Not investment advice. Derivatives can cost you everything you post. Taking a trading fee while soliciting retail investors in a given jurisdiction may constitute unlicensed brokerage there — check with a regulatory lawyer before you decide who your users are.",
  },

  // ── 런치패드 ──────────────────────────────────────
  "launchpad.title": { ko: "토큰 런치패드", en: "Token launchpad" },
  "launchpad.paperWarning": {
    ko: "페이퍼 본딩커브입니다 — 온체인 발행이 아닙니다. 토큰도 유동성도 실재하지 않고, 수수료는 로컬 파일에만 적립됩니다.",
    en: "This is a paper bonding curve — nothing is deployed on-chain. The token and its liquidity do not exist, and fees accrue only to a local file.",
  },
  "launchpad.fee": { ko: "거래 수수료 1% 적립", en: "1% trading fee accrues" },

  // ── 구독 ─────────────────────────────────────────
  "sub.title": { ko: "사용량", en: "Usage" },
  "sub.free": { ko: "무료", en: "Free" },
  "sub.freeDesc": { ko: "하루 {n}회 호출", en: "{n} calls per day" },
  "sub.paid": { ko: "USDC 결제", en: "Pay with USDC" },
  "sub.paidDesc": {
    ko: "x402 로 결제하면 한도가 풀립니다. 계정도 카드도 필요 없습니다.",
    en: "Settle over x402 and the cap lifts. No account, no card.",
  },
  "sub.remaining": { ko: "남은 호출", en: "calls left" },
  "sub.exhausted": {
    ko: "오늘 무료 한도를 다 썼습니다. USDC 로 결제하면 계속 쓸 수 있습니다.",
    en: "Free quota is used up for today. Settle in USDC to keep going.",
  },
} as const;

export type DictKey = keyof typeof DICT;

/** 번역. 없는 키는 키 자체를 돌려줘 화면에서 바로 눈에 띄게 한다. */
export function t(key: DictKey, lang: Lang, vars?: Record<string, string | number>): string {
  const entry = DICT[key];
  let s: string = entry ? entry[lang] : (key as string);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** 브라우저 설정에서 초기 언어를 고른다. 한국어 사용자면 한국어. */
export function detectLang(accept?: string | null): Lang {
  const s = (accept ?? "").toLowerCase();
  if (s.startsWith("ko") || s.includes(",ko")) return "ko";
  return DEFAULT_LANG;
}

export const LANG_LABEL: Record<Lang, string> = { ko: "한국어", en: "English" };
