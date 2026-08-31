"use client";

// 공개 지표 화면.
//
// Bankr 는 이 화면 하나로 "$5.20B 거래됨"을 보여주고 그게 곧 마케팅이다.
// 우리는 아직 그런 숫자가 없다. 그래서 크기 대신 **검증 가능성**으로 간다:
// 실거래와 페이퍼를 따로 두고, 페이퍼는 페이퍼라고 쓴다.
//
// 두 섹션을 나란히 두되 합계 줄은 만들지 않는다. 만들 수 있는데 안 만든 게 아니라,
// 데이터 모양 자체에 합계가 없다 (lib/metrics.ts).

import Link from "next/link";
import { useEffect, useState } from "react";
import { LangSwitch, useLang } from "@/components/LangProvider";
import type { PublicMetrics } from "@/lib/metrics";

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function MetricsPage() {
  const { t } = useLang();
  const [m, setM] = useState<PublicMetrics | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/v1/metrics")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setM)
      .catch(() => setFailed(true));
  }, []);

  return (
    <main className="landing">
      <nav className="nav">
        <Link href="/" className="brand">agent-terminal</Link>
        <span className="nav-links">
          <LangSwitch />
          <Link href="/terminal" className="nav-cta">{t("nav.terminal")}</Link>
        </span>
      </nav>

      <section className="hero" style={{ paddingBottom: 8 }}>
        <h1>{t("metrics.title")}</h1>
        <p className="sub">{t("metrics.sub")}</p>
      </section>

      {!m && !failed && <p className="dim-text" style={{ textAlign: "center" }}>{t("common.loading")}</p>}
      {failed && <p className="dim-text" style={{ textAlign: "center" }}>{t("common.error")}</p>}

      {m && (
        <>
          {/* 루프 설명이 먼저다. 숫자가 작을 때는 구조가 설득한다. */}
          <section className="pricing">
            <h2>{t("metrics.loop")}</h2>
            <p className="pricing-note">{t("metrics.loopDesc")}</p>
            <div className="loop-steps">
              {[t("metrics.loopStep1"), t("metrics.loopStep2"), t("metrics.loopStep3"), t("metrics.loopStep4")]
                .map((s, i) => (
                  <span key={s} className="loop-step">
                    <b>{i + 1}</b> {s}
                  </span>
                ))}
            </div>
          </section>

          <section className="grid">
            <div className="card">
              <h3>{t("metrics.live")} <span className="badge-live">{m.live.mode}</span></h3>
              <p className="dim-text">{t("metrics.liveNote")}</p>
              <dl className="stat-list">
                <div><dt>{t("metrics.builderFees")}</dt><dd>{usd(m.live.builderFeesUsdc)}</dd></div>
                <div><dt>{t("metrics.converted")}</dt><dd>{usd(m.live.convertedToCreditsUsd)}</dd></div>
                <div><dt>{t("metrics.fundedCalls")}</dt><dd>{m.live.fundedCalls.toLocaleString("en-US")}</dd></div>
              </dl>
            </div>

            <div className="card">
              <h3>{t("metrics.paper")} <span className="badge-paper">{t("common.paper")}</span></h3>
              <p className="dim-text">{t("metrics.paperNote")}</p>
              <dl className="stat-list">
                <div><dt>{t("metrics.launchpadFees")}</dt><dd>{usd(m.paper.launchpadFeesUsdc)}</dd></div>
                <div><dt>{t("metrics.swapFees")}</dt><dd>{usd(m.paper.swapFeesUsdc)}</dd></div>
                <div><dt>{t("metrics.trades")}</dt><dd>{m.paper.trades.toLocaleString("en-US")}</dd></div>
              </dl>
            </div>

            <div className="card">
              <h3>{t("metrics.coverage")}</h3>
              <p className="dim-text">{m.coverage.sampleEquities.join(" · ")}</p>
              <dl className="stat-list">
                <div><dt>{t("metrics.total")}</dt><dd>{m.coverage.total}</dd></div>
                <div><dt>{t("metrics.crypto")}</dt><dd>{m.coverage.crypto}</dd></div>
                <div><dt>{t("metrics.equities")}</dt><dd>{m.coverage.equities}</dd></div>
                <div><dt>{t("metrics.indices")}</dt><dd>{m.coverage.indicesCommodities}</dd></div>
              </dl>
            </div>
          </section>

          <footer className="footer">
            <p>{t("metrics.measuredAt")}: {new Date(m.measuredAt).toISOString()}</p>
          </footer>
        </>
      )}
    </main>
  );
}
