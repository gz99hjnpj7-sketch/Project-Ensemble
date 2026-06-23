import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, Search } from "lucide-react";
import { getForecastList } from "@/lib/forecast/read-models";
import { formatTimestamp } from "@/lib/utils/date";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = getParam(params.q);
  const category = getParam(params.category) ?? "ALL";
  const confidence = getParam(params.confidence) ?? "ALL";
  const warningsOnly = getParam(params.warnings) === "1";

  const forecasts = await getForecastList({ query, category, confidence, warningsOnly });

  return (
    <main className="shell">
      <Topbar />
      <section className="terminal">
        <form className="toolbar">
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--muted)" }} />
            <input className="control" name="q" defaultValue={query ?? ""} placeholder="Search forecasts" style={{ width: "100%", paddingLeft: 36 }} />
          </div>
          <select className="control" name="category" defaultValue={category}>
            <option value="ALL">All categories</option>
            <option value="POLITICS">Politics</option>
            <option value="MACRO">Macro</option>
          </select>
          <select className="control" name="confidence" defaultValue={confidence}>
            <option value="ALL">All confidence</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <label className="toggle">
            <input type="checkbox" name="warnings" value="1" defaultChecked={warningsOnly} />
            Warnings
          </label>
        </form>

        <Suspense fallback={<div className="empty">Loading forecasts</div>}>
          {forecasts.length ? (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Composite</th>
                    <th>Move</th>
                    <th>Confidence</th>
                    <th>Warnings</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {forecasts.map((forecast) => (
                    <tr key={forecast.id}>
                      <td>
                        <Link className="eventCell" href={`/forecasts/${forecast.slug}`}>
                          <span className="eventTitle">{forecast.title}</span>
                          <span className="muted">{forecast.category} · {forecast.marketCount} markets{forecast.marketCount === 0 ? ' (no qualifying data)' : ''}</span>

                        </Link>
                      </td>
                      <td className="prob">
                        {forecast.marketCount > 0 ? formatProbability(forecast.compositeProbability) : '—'}
                        <span className="pill" style={{marginLeft:4, fontSize:'10px'}}>Q{forecast.qualityScore || 0}</span>
                      </td>
                      <td className={moveClass(forecast.move24h)}>{formatMove(forecast.move24h)}</td>
                      <td><ConfidencePill confidence={forecast.confidence} /></td>
                      <td>
                        <span className={forecast.warningCount ? "pill medium" : "pill"}>
                          {forecast.warningCount ? <AlertTriangle size={13} /> : null}
                          {forecast.warningCount}
                        </span>
                      </td>
                      <td className="muted">{formatTimestamp(forecast.computedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">No clusters have matched ingested markets yet. Run the ingestion worker after setting DATABASE_URL.</div>
          )}
        </Suspense>
      </section>
    </main>
  );
}

function Topbar() {
  return (
    <header className="topbar">
      <div className="brand">
        <h1>Future News</h1>
        <span>Forecast intelligence terminal</span>
      </div>
      <span className="muted">Polymarket connector · 30m snapshots</span>
    </header>
  );
}

function ConfidencePill({ confidence }: { confidence: string }) {
  return <span className={`pill ${confidence.toLowerCase()}`}>{confidence}</span>;
}

function getParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatProbability(value: number | null): string {
  return value === null ? "n/a" : `${Math.round(value * 100)}%`;
}

function formatMove(value: number | null): string {
  if (value === null) return "n/a";
  const points = Math.round(value * 1000) / 10;
  return `${points > 0 ? "+" : ""}${points} pts`;
}

function moveClass(value: number | null): string {
  if (!value) return "muted";
  return value > 0 ? "moveUp" : "moveDown";
}
