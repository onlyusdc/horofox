import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // 홈 디렉토리의 stray package-lock.json이 workspace root으로 잘못 잡히는 것 방지
  outputFileTracingRoot: path.join(__dirname),
};

// 주의: `data/` 를 outputFileTracingExcludes 로 빼려다 Next 내부 파일까지 끊겨 빌드가 깨졌다.
// 대신 scripts/deploy-cf.sh 가 빌드 후 .open-next 에서 data/ 를 제거하고,
// scripts/test-nosecrets.ts 가 그게 실제로 비었는지 검증한다.

export default nextConfig;
