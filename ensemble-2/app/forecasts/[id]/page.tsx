import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { ForecastChart } from "@/components/ForecastChart";
import { getForecastDetail } from "@/ensemble/serving/read-models";
import { formatTimestamp } from "@/ensemble/utils/date";

export default async function ForecastDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forecast = await getForecastDetail(id);
  if (!forecast) notFound();
  return (
    <main className="shell">
      <header className="topbar"><div className="brand"><Link href="/">Ensemble</Link><span>{forecast.category}</span></div><span className="muted">{formatTimestamp(forecast.current?.computedAt)}</span></header>
      <section className="terminal">
        <div><h1 style={{ margin: "0 0 6px", fontSize: 28 }}>{forecast.title}</h1><p className="muted" style={{ margin: 0 }}>{forecast.description}</p></div>
        <div className="detailGrid">
          <section className="panel">
            <div className="panelHeader"><h2>Composite Forecast</h2><span className="prob">{formatProbability(forecast.current?.compositeProbability ?? null)}</span></div>
            <div className="panelBody">
              <ForecastChart compositeData={forecast.compositeHistory} series={topMarketSeries(forecast.markets)} />
              <div className="metricRow" style={{ marginTop: 10 }}>
                <span className="pill">Band {forecast.current?.confidenceBand ?? "NORMAL"}</span>
                <span className="pill">Quality {forecast.current?.qualityScore ?? 0}</span>
                <span className="pill">Included {forecast.sourceAudit.policy?.includedMarketIds?.length ?? 0}</span>
                <span className="pill">Excluded {forecast.sourceAudit.policy?.excludedSources?.length ?? 0}</span>
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="panelHeader"><h2>Source Audit Trail</h2><span className="pill">{forecast.markets.length} markets</span></div>
            <div className="panelBody marketList">
              {forecast.markets.map((market) => <article className="marketItem" key={market.id}>
                <div><strong>{market.question}</strong><div className="muted">{market.sourcePlatform} {market.closeTime ? "/ closes " + formatTimestamp(market.closeTime) : ""}</div></div>
                <div className="metricRow"><span className="pill">Prob {formatProbability(market.probability)}</span><span className="pill">Quality {market.quality?.score ?? 0}</span><span className="pill">Liq {formatNumber(market.liquidity)}</span><span className="pill">Vol {formatNumber(market.volume)}</span></div>
                {market.latestMatch ? <div className="muted" style={{ fontSize: 12 }}>Match: {market.latestMatch.outcome} by {market.latestMatch.method} ({Math.round(market.latestMatch.confidence * 100)}%) / {market.latestMatch.reason}</div> : null}
                {market.warnings.length ? <ul className="warningList">{market.warnings.map((warning: any) => <li key={warning.id}>{warning.message}</li>)}</ul> : null}
                {market.sourceUrl ? <a className="pill" href={market.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Source market</a> : null}
              </article>)}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function topMarketSeries(markets: any[]) {
  return [...markets].sort((a, b) => (b.probability || 0) - (a.probability || 0)).slice(0, 4).map((market) => ({ name: market.question.length > 40 ? market.question.slice(0, 37) + "..." : market.question, data: market.snapshots.map((snapshot: any) => ({ observedAt: snapshot.observedAt, probability: snapshot.probability })) }));
}
function formatProbability(value: number | null): string { return value === null ? "n/a" : `${Math.round(value * 100)}%`; }
function formatNumber(value: number | null): string { return value === null ? "n/a" : Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
