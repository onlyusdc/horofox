// 소셜 채널 공통 인터페이스.
//
// `link` 를 문자열에 섞지 않고 별도 옵션으로 둔 이유: X 는 링크 유무로 가격이 13배 차이난다
// (게시 $0.015 vs 링크 포함 $0.20). 본문에 URL 을 넣어버리면 비용을 미리 계산할 수 없고,
// 그러면 상한을 강제할 수도 없다. 채널이 링크를 붙이기 직전에 예산을 확인한다.

import type { ChannelName } from "../../lib/social/budget";

export type Mention = {
  /** 채널 내 고유 id. 중복 답글 방지의 키다. */
  id: string;
  text: string;
  /** 표시용 작성자 핸들. */
  author: string;
  permalink?: string;
};

export type SendOpts = {
  /** 붙일 링크. X 에서는 이게 비용을 13배로 올린다. */
  link?: string;
};

export interface Channel {
  readonly name: ChannelName;
  /** 자격증명이 갖춰졌는가. 없으면 실행기가 이유를 출력하고 건너뛴다. */
  configured(): boolean;
  /** 미설정 사유 + 발급 방법. 텔레그램 커넥터와 같은 형식이다. */
  setupHint(): string;
  fetchMentions(sinceId?: string): Promise<Mention[]>;
  reply(mention: Mention, text: string, opts?: SendOpts): Promise<void>;
  post(text: string, opts?: SendOpts): Promise<void>;
}
