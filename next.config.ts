import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // 홈 디렉토리의 stray package-lock.json이 workspace root으로 잘못 잡히는 것 방지
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
