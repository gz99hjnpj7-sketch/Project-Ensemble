import Link from "next/link";
import { Search } from "lucide-react";
import { getForecastDashboard } from "@/ensemble/serving/read-models";
import { formatTimestamp } from "@/ensemble/utils/date";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = getParam(params.q);
  const category = getParam(params.category) ?? "ALL";
  const confidence = getParam(params.confidence) ?? "ALL";
  const { forecasts, summary } = await getForecastDashboard({ query, category, confidence });

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><h1>Ensemble</h1><span>Collect - Match - Combine - Serve</span></div>
        <span className="muted">Last run {summary.lastRun ? `${summary.lastRun.status} ${formatTimestamp(summary.lastRun.startedAt)}` : "not started"}</span>
      </header>
      <section className="terminal">
        <div className="metricRow">
          <span className="pill">Forecasts {summary.forecastCount}</span>
          <span className="pill">Clustered markets {summary.clusteredMarketCount}</span>
          <span className="pill">Unclustered markets {summary.unclusteredMarketCount}</span>
        </div>
        <form className="toolbar">
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--muted)" }} />
            <input className="control" name="q" defaultValue={query ?? ""} placeholder="Search forecasts" style={{ width: "100%", paddingLeft: 36 }} />
          </div>
          <select className="control" name="category" defaultValue={category}>
            <option value="ALL">All categories</option><option value="POLITICS">Politics</option><option value="MACRO">Macro</option><option value="CRYPTO">Crypto</option><option value="WORLD">World</option><option value="OTHER">Other</option>
          </select>
          <select className="control" name="confidence" defaultValue={confidence}>
            <option value="ALL">All confidence</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
          </select>
        </form>
        {forecasts.length ? (
          <div className="tableWrap"><table><thead><tr><th>Event</th><th>Composite</th><th>Confidence</th><th>Quality</th><th>Sources</th><th>Updated</th></tr></thead><tbody>
            {forecasts.map((forecast) => <tr key={forecast.id}>
              <td>
                <div className="eventCell">
                  <Link href={`/forecasts/${forecast.slug}`}><span className="eventTitle">{forecast.title}</span></Link>
                  <span className="muted">{forecast.category} / {forecast.marketCount} included sources</span>
                  <details className="sourceDetails">
                    <summary>What this number means</summary>
                    <SourceBreakdown sources={forecast.sources} policy={forecast.policy} />
                  </details>
                </div>
              </td>
              <td className="prob">{formatProbability(forecast.compositeProbability)}</td>
              <td><span className={`pill ${forecast.confidence.toLowerCase()}`}>{forecast.confidence}</span></td>
              <td><span className="pill">Q{forecast.qualityScore}</span></td>
              <td><span className="pill">{forecast.marketCount} included</span></td>
              <td className="muted">{formatTimestamp(forecast.computedAt)}</td>
            </tr>)}
          </tbody></table></div>
        ) : <div className="empty">No forecast cache yet. Run the ingestion worker after seeding the database.</div>}
      </section>
    </main>
  );
}

function getParam(value: string | string[] | undefined): string | undefined { return Array.isArray(value) ? value[0] : value; }
function formatProbability(value: number | null): string { return value === null ? "n/a" : `${Math.round(value * 100)}%`; }
function SourceBreakdown({ sources, policy }: { sources: any[]; policy: any | null }) {
  const included = sources.filter((source) => source.included).sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
  if (!included.length) return <p className="muted">No usable source markets yet. Run ingestion and check that a seed cluster has matching markets.</p>;
  return (
    <div className="sourceList">
      {included.slice(0, 6).map((source) => (
        <div className="sourceRow" key={source.marketId}>
          <div>
            <div className="sourceTitle">{source.displayQuestion ?? source.question}</div>
            <div className="muted">{source.sourcePlatform}</div>
          </div>
          <span>{formatProbability(source.probability)} · Quality {source.qualityScore} · weight {formatWeight(source.weight)}</span>
        </div>
      ))}
      {policy?.excludedSources?.length ? <p className="muted">{policy.excludedSources.length} source markets were left out because they were closed, missing a price, or too low quality.</p> : null}
    </div>
  );
}
function formatWeight(value: number | null | undefined): string { return typeof value === "number" ? value.toFixed(2) : "n/a"; }
