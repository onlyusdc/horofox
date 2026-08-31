import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// 캐시는 기본값(메모리) 사용. 공개 데모는 읽기 전용이라 영속 캐시가 필요 없다.
export default defineCloudflareConfig();
