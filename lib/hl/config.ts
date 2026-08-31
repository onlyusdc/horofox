// Hyperliquid 엔진 설정.
//
// 이 파일의 가장 중요한 규칙: **기본값은 항상 PAPER**.
// 키가 있다는 이유만으로 실주문이 나가면 안 된다. LIVE 는 명시적으로 켜야 한다.

/** 내 builder 지갑. 거래 수수료가 여기로 쌓인다. 이게 유일한 수익원이다. */
export const BUILDER_ADDRESS = (process.env.HL_BUILDER_ADDRESS ?? "")
  .trim()
  .toLowerCase() as `0x${string}` | "";

/** 내가 걷는 수수료율(%). 퍼프 상한 0.1%. */
export const PERP_FEE_PERCENT = Number(process.env.HL_BUILDER_FEE_PERCENT ?? "0.1");

/** Hyperliquid가 강제하는 상한. 넘기면 주문 전체가 거부된다. */
export const MAX_PERP_FEE_PERCENT = 0.1;
export const MAX_SPOT_FEE_PERCENT = 1.0;

/** 빌더 자격: 퍼프 계정 가치 최소 100 USDC. 미달이면 내 주문이 전부 거부된다. */
export const BUILDER_MIN_PERP_ACCOUNT_USDC = 100;

/** 유저에게 승인받을 최대 요율. 실제 요율 이상이어야 한다. */
export const APPROVAL_MAX_FEE_PERCENT = Number(
  process.env.HL_APPROVAL_MAX_FEE_PERCENT ?? String(MAX_PERP_FEE_PERCENT),
);

/** 자산별 상한과 별개로 우리가 거는 천장. */
export const LEVERAGE_CAP = Number(process.env.HL_LEVERAGE_CAP ?? "20");

/** HL은 명목가 $10 미만 주문을 거부한다. 왕복 실패를 미리 막는다. */
export const MIN_ORDER_USD = 10;

/** 시장가를 IOC 리밋으로 환산할 때 허용 슬리피지. */
export const DEFAULT_SLIPPAGE = Number(process.env.HL_SLIPPAGE ?? "0.05");

/** 퍼프/스팟 가격 소수점 상한. HL 고정값. */
export const MAX_DECIMALS = { perp: 6, spot: 8 } as const;

export const IS_TESTNET = process.env.HL_NETWORK === "testnet";

/**
 * 읽을 HIP-3 dex. `xyz` 가 주식·지수·원자재 퍼프의 사실상 전부다
 * (SKHX·SMSN·DRAM 등, 24h 약 $17억).
 */
export const HIP3_DEXES = ["xyz"] as const;

/** 트레이더 개인키. 있어야 LIVE 가 가능하지만, 있다고 LIVE 가 되는 건 아니다. */
export const TRADER_KEY = (process.env.HL_TRADER_KEY ?? process.env.EVM_PRIVATEKEY ?? "").trim();

export type TradeMode = "paper" | "live";

/**
 * 현재 모드. **LIVE 는 세 조건이 모두 참일 때만** 켜진다:
 *   1. HL_MODE=live 를 명시
 *   2. 트레이더 키 존재
 *   3. builder 주소 설정
 * 하나라도 빠지면 PAPER 로 떨어진다 — 조용히 실주문이 나가는 사고를 구조적으로 막는다.
 */
export function tradeMode(): TradeMode {
  const asked = (process.env.HL_MODE ?? "paper").trim().toLowerCase();
  if (asked !== "live") return "paper";
  if (!TRADER_KEY) return "paper";
  if (!BUILDER_ADDRESS) return "paper";
  return "live";
}

/** LIVE 가 아닐 때 그 이유를 사람이 읽을 수 있게 설명한다. */
export function modeReason(): string {
  const asked = (process.env.HL_MODE ?? "paper").trim().toLowerCase();
  if (asked !== "live") return "HL_MODE 가 live 가 아님 (기본 paper)";
  if (!TRADER_KEY) return "HL_TRADER_KEY(또는 EVM_PRIVATEKEY) 미설정";
  if (!BUILDER_ADDRESS) return "HL_BUILDER_ADDRESS 미설정 — 수수료 받을 주소가 없음";
  return "live";
}
