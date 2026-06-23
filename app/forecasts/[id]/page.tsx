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
  const auditByMarketId = new Map(forecast.sourceAudit.sources.map((source: any) => [source.marketId, source]));
  const headlineSourceCount = forecast.sourceAudit.sources.filter((source: any) => source.included).length;
  const supportingSourceCount = forecast.sourceAudit.sources.filter((source: any) => source.sourceRole === "supporting").length;
  return (
    <main className="shell">
      <header className="topbar"><div className="brand"><Link href="/">Ensemble</Link><span>{forecast.category}</span></div><span className="muted">{formatTimestamp(forecast.current?.computedAt)}</span></header>
      <section className="terminal">
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28 }}>{forecast.title}</h1>
          <p className="muted" style={{ margin: 0 }}>{forecast.description}</p>
          <div className="futureNewsBlock">
            <strong>{forecast.futureNews.headline}</strong>
            <span>{forecast.futureNews.summary}</span>
            <span className="muted">Source basis: {forecast.futureNews.basis}</span>
          </div>
        </div>
        <div className="detailGrid">
          <section className="panel">
            <div className="panelHeader"><h2>Composite Forecast</h2><span className="prob">{formatProbability(forecast.current?.compositeProbability ?? null)}</span></div>
            <div className="panelBody">
              <ForecastChart compositeData={forecast.compositeHistory} series={topMarketSeries(forecast.markets, forecast.sourceAudit.sources)} />
              <div className="metricRow" style={{ marginTop: 10 }}>
                <span className="pill">Band {forecast.current?.confidenceBand ?? "NORMAL"}</span>
                <span className="pill">Quality {forecast.current?.qualityScore ?? 0}</span>
                <span className="pill">Headline sources {headlineSourceCount}</span>
                <span className="pill">Supporting {supportingSourceCount}</span>
                <span className="pill">Excluded {forecast.sourceAudit.policy?.excludedSources?.length ?? 0}</span>
              </div>
              <div className="metricRow" style={{ marginTop: 10 }}>
                <MovementPill label="Last run" movement={forecast.movement?.previousRun} />
                <MovementPill label="Since first" movement={forecast.movement?.sinceFirst} />
                <MovementPill label="24h" movement={forecast.movement?.day} />
                <MovementPill label="7d" movement={forecast.movement?.week} />
              </div>
              {forecast.sourceAudit.outcomeBreakdown?.length ? (
                <div className="metricRow" style={{ marginTop: 10 }}>
                  {forecast.sourceAudit.outcomeBreakdown.slice(0, 3).map((outcome: any) => <span className="pill" key={outcome.name}>{outcome.name} {formatProbability(outcome.probability)}</span>)}
                </div>
              ) : null}
            </div>
          </section>
          <section className="panel">
            <div className="panelHeader"><h2>Source Audit Trail</h2><span className="pill">{forecast.markets.length} markets</span></div>
            <div className="panelBody marketList">
              {forecast.markets.map((market: any) => {
                const audit = auditByMarketId.get(market.id) as any;
                const marketMove = sourceMove(market, audit);
                return (
                  <article className="marketItem" key={market.id}>
                    <div><strong>{market.question}</strong><div className="muted">{market.sourcePlatform} {market.closeTime ? "/ closes " + formatTimestamp(market.closeTime) : ""}</div></div>
                    <div className="metricRow">
                      <span className="pill">{audit?.sourceRole === "headline" ? "Headline" : audit?.sourceRole === "supporting" ? "Supporting" : "Excluded"}</span>
                      <span className="pill">Raw {formatProbability(market.probability)}</span>
                      {audit ? <span className="pill">Normalized {formatProbability(audit.probability)}</span> : null}
                      <span className={`pill ${typeof marketMove === "number" && marketMove > 0 ? "moveUp" : typeof marketMove === "number" && marketMove < 0 ? "moveDown" : ""}`}>Source move {formatPoints(marketMove)}</span>
                      <span className="pill">Quality {market.quality?.score ?? 0}</span>
                      <span className="pill">Liq {formatNumber(market.liquidity)}</span>
                      <span className="pill">Vol {formatNumber(market.volume)}</span>
                    </div>
                    {audit?.orientation ? <div className="muted" style={{ fontSize: 12 }}>Orientation: {audit.orientation}</div> : null}
                    {market.latestMatch ? <div className="muted" style={{ fontSize: 12 }}>Match: {market.latestMatch.outcome} by {market.latestMatch.method} ({Math.round(market.latestMatch.confidence * 100)}%) / {market.latestMatch.reason}</div> : null}
                    {market.warnings.length ? <ul className="warningList">{market.warnings.map((warning: any) => <li key={warning.id}>{warning.message}</li>)}</ul> : null}
                    {market.sourceUrl ? <a className="pill" href={market.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Source market</a> : null}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function topMarketSeries(markets: any[], sources: any[]) {
  const sourceById = new Map(sources.map((source) => [source.marketId, source]));
  return [...markets]
    .sort((a, b) => (normalizedCurrentProbability(b, sourceById.get(b.id)) || 0) - (normalizedCurrentProbability(a, sourceById.get(a.id)) || 0))
    .slice(0, 4)
    .map((market) => {
      const source = sourceById.get(market.id);
      const name = source?.displayQuestion ?? market.question;
      return {
        name: name.length > 40 ? name.slice(0, 37) + "..." : name,
        data: market.snapshots.map((snapshot: any) => ({
          observedAt: snapshot.observedAt,
          probability: normalizeSnapshotProbability(snapshot.probability, source)
        }))
      };
    });
}

function normalizedCurrentProbability(market: any, source: any): number | null {
  return normalizeSnapshotProbability(market.probability, source);
}

function normalizeSnapshotProbability(probability: number | null, source: any): number | null {
  if (probability === null || probability === undefined) return null;
  return source?.orientation?.startsWith("Inverted") ? 1 - probability : probability;
}
function sourceMove(market: any, source: any): number | null {
  const snapshots = market.snapshots ?? [];
  if (snapshots.length < 2) return null;
  const previous = normalizeSnapshotProbability(snapshots.at(-2)?.probability ?? null, source);
  const latest = normalizeSnapshotProbability(snapshots.at(-1)?.probability ?? null, source);
  return typeof previous === "number" && typeof latest === "number" ? latest - previous : null;
}
function formatProbability(value: number | null): string { return value === null ? "n/a" : `${Math.round(value * 100)}%`; }
function formatNumber(value: number | null): string { return value === null ? "n/a" : Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
function formatPoints(value: number | null | undefined): string {
  if (typeof value !== "number") return "n/a";
  const points = value * 100;
  const sign = points > 0 ? "+" : "";
  return `${sign}${points.toFixed(Math.abs(points) < 1 ? 1 : 0)} pts`;
}
function MovementPill({ label, movement }: { label: string; movement: any }) {
  return <span className={`pill ${movement?.probability > 0 ? "moveUp" : movement?.probability < 0 ? "moveDown" : ""}`}>{label} {movement ? formatPoints(movement.probability) : "n/a"}</span>;
}
