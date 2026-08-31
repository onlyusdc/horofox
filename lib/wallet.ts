// 온체인 지갑 조회 — viem 공개 RPC (키 불필요)
// EVM_PRIVATEKEY가 있으면 "내 지갑" 모드: 주소 생략 시 해당 지갑 사용

import { createPublicClient, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const client = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

export function localWalletAddress(): string | null {
  const pk = process.env.EVM_PRIVATEKEY?.trim();
  if (!pk) return null;
  try {
    return privateKeyToAccount(pk.startsWith("0x") ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`)).address;
  } catch {
    return null;
  }
}

export async function onchainBalance(addressArg?: string) {
  const address = (addressArg?.trim() || localWalletAddress()) as `0x${string}` | null;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address))
    return { ok: false as const, error: "유효한 주소 필요 (또는 EVM_PRIVATEKEY 설정)" };

  const wei = await client.getBalance({ address });
  return {
    ok: true as const,
    address,
    network: "base-sepolia",
    ethBalance: Number(formatEther(wei)),
  };
}
