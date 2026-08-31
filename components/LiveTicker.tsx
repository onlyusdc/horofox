"use client";

// 랜딩 첫 화면의 살아있는 숫자.
// "이게 뭔지 모르겠다"는 피드백의 핵심 원인이 여기였다 — 설명만 있고 증거가 없었다.
// Hyperliquid 를 브라우저에서 직접 읽어 보여준다 (백엔드 불필요).

import { useEffect, useState } from "react";
import { useLang } from "./LangProvider";

type Row = { sym: string; label: string; px: number };

const WATCH: [string, string, string][] = [
  ["NVDA", "엔비디아", "Nvidia"],
  ["SKHX", "SK하이닉스", "SK Hynix"],
  ["SP500", "S&P 500", "S&P 500"],
  ["GOLD", "금", "Gold"],
];

export default function LiveTicker() {
  const { lang, t } = useLang();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [counts, setCounts] = useState<{ total: number; hip3: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("https://api.hyperliquid.xyz/info", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "metaAndAssetCtxs", dex: "xyz" }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const [meta, ctxs] = (await res.json()) as [
          { universe: { name: string; isDelisted?: boolean }[] },
          { markPx: string }[],
        ];
        if (!alive) return;

        const bySym = new Map<string, number>();
        meta.universe.forEach((u, i) => {
          const sym = u.name.includes(":") ? u.name.split(":")[1]! : u.name;
          const px = Number(ctxs[i]?.markPx ?? 0);
          if (px > 0) bySym.set(sym, px);
        });

        setRows(
          WATCH.map(([sym, ko, en]) => ({ sym, label: lang === "ko" ? ko : en, px: bySym.get(sym) ?? 0 }))
            .filter((r) => r.px > 0),
        );
        setFailed(false);

        // 총계는 브라우저에서 조립하지 않는다. 서버가 실제로 주문 가능한 자산을 센 값을 쓴다.
        const m = (await fetch("/api/v1/metrics")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)) as { coverage?: { total: number; hip3: number } } | null;
        if (alive && m?.coverage) setCounts({ total: m.coverage.total, hip3: m.coverage.hip3 });
      } catch {
        if (alive) setFailed(true);
      }
    };
    load();
    const id = setInterval(load, 20_000);
    return () => { alive = false; clearInterval(id); };
  }, [lang]);

  return (
    <div className="ticker">
      <div className="ticker-head">
        <b>{t("ticker.title")}</b>
        <span className="dim-text">{t("ticker.sub")}</span>
      </div>

      <div className="ticker-rows">
        {rows === null && !failed && <span className="dim-text">{t("common.loading")}</span>}
        {failed && <span className="dim-text">Hyperliquid — {t("common.error")}</span>}
        {rows?.map((r) => (
          <div className="ticker-cell" key={r.sym}>
            <span className="tk-sym">{r.sym}</span>
            <span className="tk-px">${r.px.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
            <span className="tk-label">{r.label}</span>
          </div>
        ))}
      </div>

      {counts && (
        <div className="ticker-stats">
          <span><b>{counts.total}</b> {t("ticker.assets")}</span>
          <span><b>{counts.hip3}</b> {t("ticker.hip3")}</span>
          <span><b>0.1%</b> {t("ticker.fee")}</span>
        </div>
      )}
    </div>
  );
}
