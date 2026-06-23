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
        <div className="brand">
          <h1>Ensemble</h1>
          <span>Forecast intelligence terminal</span>
        </div>
        <span className="muted">{summary.lastRun ? formatTimestamp(summary.lastRun.startedAt) : "No run yet"}</span>
      </header>
      <section className="terminal">
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
          <div className="tableWrap"><table><thead><tr><th>Event</th><th>Composite</th><th>Movement</th><th>Confidence</th><th>Quality</th><th>Headline sources</th><th>Updated</th></tr></thead><tbody>
            {forecasts.map((forecast) => <tr key={forecast.id}>
              <td>
                <div className="eventCell">
                  <Link href={`/forecasts/${forecast.slug}`}><span className="eventTitle">{forecast.title}</span></Link>
                  <span className="muted">{forecast.category} / {forecast.description}</span>
                  <span className="futureHeadline">{forecast.futureNews.headline}</span>
                  <details className="sourceDetails">
                    <summary>What this number means</summary>
                    <SourceBreakdown sources={forecast.sources} policy={forecast.policy} outcomeBreakdown={forecast.outcomeBreakdown} />
                  </details>
                </div>
              </td>
              <td>
                <div className="prob">{formatProbability(forecast.compositeProbability)}</div>
                {forecast.outcomeBreakdown?.[0] ? <div className="muted" style={{ fontSize: 12 }}>{forecast.outcomeBreakdown[0].name} lead</div> : null}
              </td>
              <td className="movementCell"><MovementSummary movement={forecast.movement} /></td>
              <td><span className={`pill ${forecast.confidence.toLowerCase()}`}>{forecast.confidence}</span></td>
              <td><span className="pill">Q{forecast.qualityScore}</span></td>
              <td><span className="pill">{forecast.marketCount} headline</span></td>
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
function formatPoints(value: number | null | undefined): string {
  if (typeof value !== "number") return "n/a";
  const points = value * 100;
  const sign = points > 0 ? "+" : "";
  return `${sign}${points.toFixed(Math.abs(points) < 1 ? 1 : 0)} pts`;
}
function movementClass(value: number | null | undefined): string {
  if (typeof value !== "number" || Math.abs(value) < 0.0005) return "muted";
  return value > 0 ? "moveUp" : "moveDown";
}
function MovementSummary({ movement }: { movement: any }) {
  const primary = movement?.day ?? movement?.sinceFirst ?? movement?.previousRun ?? null;
  const label = movement?.day ? "24h" : movement?.sinceFirst ? "since first" : movement?.previousRun ? "last run" : "history";
  return (
    <div>
      <div className={movementClass(primary?.probability)}>{primary ? formatPoints(primary.probability) : "not enough history"}</div>
      <div className="muted movementMeta">{label}{movement?.pointCount ? ` · ${movement.pointCount} runs` : ""}</div>
    </div>
  );
}
function SourceBreakdown({ sources, policy, outcomeBreakdown }: { sources: any[]; policy: any | null; outcomeBreakdown: any[] | null }) {
  const included = sources.filter((source) => source.included).sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
  const supporting = sources.filter((source) => source.sourceRole === "supporting").sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
  if (!included.length) return <p className="muted">No usable source markets yet. Run ingestion and check that a seed cluster has matching markets.</p>;
  return (
    <div className="sourceList">
      {included.slice(0, 6).map((source) => (
        <div className="sourceRow" key={source.marketId}>
          <div className="sourceTitle">{source.displayQuestion ?? source.question}</div>
          <span>{formatProbability(source.probability)} · Quality {source.qualityScore} · headline weight {formatWeight(source.weight)}{source.sourceUrl ? <> · <a className="sourceLink" href={source.sourceUrl} target="_blank" rel="noreferrer">Source</a></> : null}</span>
        </div>
      ))}
      {supporting.length ? <p className="muted">{supporting.length} supporting markets kept for audit/detail context but not averaged into the headline.</p> : null}
      {outcomeBreakdown?.length ? <OutcomeBreakdown outcomes={outcomeBreakdown} /> : null}
      {policy?.excludedSources?.length ? <p className="muted">{policy.excludedSources.length} source markets were left out because they were closed, missing a price, or too low quality.</p> : null}
    </div>
  );
}
function formatWeight(value: number | null | undefined): string { return typeof value === "number" ? value.toFixed(2) : "n/a"; }

function OutcomeBreakdown({ outcomes }: { outcomes: any[] }) {
  return (
    <div className="metricRow">
      {outcomes.slice(0, 3).map((outcome) => <span className="pill" key={outcome.name}>{outcome.name} {formatProbability(outcome.probability)}</span>)}
    </div>
  );
}
