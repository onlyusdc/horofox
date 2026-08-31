// 예시 스킬 — Base Sepolia 가스비 조회
// 스킬 = 이 파일 하나 + skills/index.ts에 import 한 줄
import { tool } from "ai";
import { z } from "zod";
import { createPublicClient, formatGwei, http } from "viem";
import { baseSepolia } from "viem/chains";

const client = createPublicClient({ chain: baseSepolia, transport: http() });

export const tools = {
  getGasPrice: tool({
    description: "Get the current gas price on Base Sepolia in gwei.",
    inputSchema: z.object({}),
    execute: async () => {
      const wei = await client.getGasPrice();
      return { network: "base-sepolia", gwei: Number(formatGwei(wei)) };
    },
  }),
};
