// Agent Terminal CLI — LLM 없이 툴을 직접 호출 (Bankr CLI에 해당)
// 실행: npm run cli -- <커맨드> [인자...]
import "../lib/env";
import { getUsdPrice } from "../lib/price";
import { portfolio, swap } from "../lib/ledger";
import { closePerp, getPerpMid, getPerpPositions, openPerp } from "../lib/perps";
import { buyToken, getLaunchpad, launchToken, sellToken } from "../lib/launchpad";
import { onchainBalance } from "../lib/wallet";

const USAGE = `사용법: npm run cli -- <커맨드> [인자...]

  price <symbol>                    시세 조회 (예: price eth)
  swap <from> <to> <amount>         페이퍼 스왑 (예: swap usdc eth 100)
  portfolio                         포트폴리오
  perp <coin> <long|short> <usd> [lev]  페이퍼 퍼펫 (예: perp eth long 50 5)
  perps                             퍼펫 포지션
  close <coin>                      퍼펫 청산
  launch <name> <SYMBOL>            토큰 발행 (예: launch "My Coin" MC)
  buy <SYMBOL> <usdc>               본딩커브 매수
  sell <SYMBOL> <tokenAmount>       본딩커브 매도
  launchpad                         런치패드 현황(수수료 포함)
  bal [address]                     Base Sepolia 잔액`;

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) {
    console.log(USAGE);
    return;
  }

  switch (cmd) {
    case "price":
      console.log(await getUsdPrice(args[0] ?? ""));
      break;
    case "swap":
      console.log(JSON.stringify(await swap(args[0], args[1], Number(args[2])), null, 2));
      break;
    case "portfolio":
      console.log(JSON.stringify(await portfolio(), null, 2));
      break;
    case "perp":
      console.log(JSON.stringify(await openPerp(args[0], (args[1] as "long" | "short") ?? "long", Number(args[2]), Number(args[3] ?? 1)), null, 2));
      break;
    case "perps":
      console.log(JSON.stringify(await getPerpPositions(), null, 2));
      break;
    case "close":
      console.log(JSON.stringify(await closePerp(args[0]), null, 2));
      break;
    case "launch":
      console.log(JSON.stringify(await launchToken(args[0] ?? "", args[1] ?? ""), null, 2));
      break;
    case "buy":
      console.log(JSON.stringify(await buyToken(args[0], Number(args[1])), null, 2));
      break;
    case "sell":
      console.log(JSON.stringify(await sellToken(args[0], Number(args[1])), null, 2));
      break;
    case "launchpad":
      console.log(JSON.stringify(await getLaunchpad(), null, 2));
      break;
    case "bal":
      console.log(JSON.stringify(await onchainBalance(args[0]), null, 2));
      break;
    default:
      console.error(`알 수 없는 커맨드: ${cmd}\n${USAGE}`);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error("에러:", e instanceof Error ? e.message : e);
  process.exit(1);
});
