// 주문 도메인 타입. hanliq 의 intent.ts 에서 주문에 필요한 부분만 가져왔다
// (한국어 자연어 파서는 이 프로젝트에 불필요 — LLM 이 이미 그 역할을 한다).

export type Side = "long" | "short";

/** 익절/손절 지정 방식. 절대가격 또는 진입가 대비 퍼센트. */
export type TpSl = { type: "price"; value: number } | { type: "percent"; value: number };
