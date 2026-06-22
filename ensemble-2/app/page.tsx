import Link from "next/link";
import { AlertTriangle, Search } from "lucide-react";
import { getForecastDashboard } from "@/ensemble/serving/read-models";
import { formatTimestamp } from "@/ensemble/utils/date";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = getParam(params.q);
  const category = getParam(params.category) ?? "ALL";
  const confidence = getParam(params.confidence) ?? "ALL";
  const warningsOnly = getParam(params.warnings) === "1";
  const { forecasts, summary } = await getForecastDashboard({ query, category, confidence, warningsOnly });

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
          <span className={summary.warningCount ? "pill medium" : "pill"}>Warnings {summary.warningCount}</span>
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
          <label className="toggle"><input type="checkbox" name="warnings" value="1" defaultChecked={warningsOnly} />Warnings</label>
        </form>
        {forecasts.length ? (
          <div className="tableWrap"><table><thead><tr><th>Event</th><th>Composite</th><th>Confidence</th><th>Band</th><th>Warnings</th><th>Updated</th></tr></thead><tbody>
            {forecasts.map((forecast) => <tr key={forecast.id}>
              <td><Link className="eventCell" href={`/forecasts/${forecast.slug}`}><span className="eventTitle">{forecast.title}</span><span className="muted">{forecast.category} / {forecast.marketCount} included sources</span></Link></td>
              <td className="prob">{formatProbability(forecast.compositeProbability)}</td>
              <td><span className={`pill ${forecast.confidence.toLowerCase()}`}>{forecast.confidence}</span></td>
              <td><span className="pill">{forecast.confidenceBand}</span></td>
              <td><span className={forecast.warningCount ? "pill medium" : "pill"}>{forecast.warningCount ? <AlertTriangle size={13} /> : null}{forecast.warningCount}</span></td>
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
