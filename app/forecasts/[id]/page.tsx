import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { ForecastChart } from "@/components/ForecastChart";
import { getForecastDetail } from "@/lib/forecast/read-models";
import { formatTimestamp } from "@/lib/utils/date";

export default async function ForecastDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forecast = await getForecastDetail(id);
  if (!forecast) notFound();

  const topMarket = forecast.markets.length
    ? forecast.markets.reduce((a, b) => ((a.probability || 0) > (b.probability || 0) ? a : b))
    : null;

  // Sort by close date asc for timeline sense
  const sortedMarkets = [...forecast.markets].sort((a, b) => {
    const da = a.closeTime ? new Date(a.closeTime).getTime() : Infinity;
    const db = b.closeTime ? new Date(b.closeTime).getTime() : Infinity;
    return da - db;
  });
  const grouped = sortedMarkets.reduce((acc: Record<string, typeof sortedMarkets>, m) => {
    const key = m.eventTitle || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <Link href="/">Future News</Link>
          <span>{forecast.category}</span>
        </div>
        <span className="muted">{formatTimestamp(forecast.latestComposite?.computedAt)}</span>
      </header>
      <section className="terminal">
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28 }}>{forecast.title}</h1>
          <p className="muted" style={{ margin: 0 }}>{forecast.description}</p>
          {topMarket && topMarket.probability != null && (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>
              Composite = probability of the current leader (highest individual market). Currently: <strong>{topMarket.question}</strong> at {(topMarket.probability * 100).toFixed(1)}%.
            </p>
          )}
        </div>

        <div className="detailGrid">
          <section className="panel">
            <div className="panelHeader">
              <h2>Composite Forecast</h2>
              <span className="prob">{formatProbability(forecast.latestComposite?.compositeProbability ?? null)}</span>
            </div>
            <div className="panelBody">
              <ForecastChart
                compositeData={forecast.compositeHistory}
                series={(forecast as any).topMarketSeries || []}
              />
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                Solid line = cluster frontrunner probability (max individual market prob at each time). Dashed = top individual markets.
              </p>
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <h2>Source Breakdown</h2>
              <span className="pill">{forecast.markets.length} markets</span>
            </div>
            <div className="panelBody marketList">
              {Object.entries(grouped).map(([event, ms]) => {
                const groupClose = ms.find((m: any) => m.closeTime)?.closeTime;
                return (
                <div key={event} style={{ marginBottom: 16 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6, fontWeight: 600 }}>{event}{groupClose ? " · closes " + formatTimestamp(groupClose) : ""} (top by prob)</div>
                  {ms.map((market) => (
                    <article className="marketItem" key={market.id}>
                      <div>
                        <strong>{market.question}</strong>
                        <div className="muted">{market.sourcePlatform} {market.closeTime ? "· " + formatTimestamp(market.closeTime) : ""}</div>
                      </div>
                      <div className="metricRow">
                        <span className="pill">Prob {formatProbability(market.probability)}</span>
                        <span className="pill">Quality {market.quality?.score ?? 0}</span>
                        <span className="pill">Liq {formatNumber(market.liquidity)}</span>
                        <span className="pill">Vol {formatNumber(market.volume)}</span>
                      </div>
                      {qualityFlags(market.quality?.flags).length ? (
                        <div className="metricRow">
                          {qualityFlags(market.quality?.flags).map((flag) => <span className="pill" key={flag}>{flag}</span>)}
                        </div>
                      ) : null}
                      {market.warnings.length ? (
                        <ul className="warningList">
                          {market.warnings.map((warning) => <li key={warning.id}>{warning.message}</li>)}
                        </ul>
                      ) : null}
                      {market.sourceUrl ? (
                        <a className="pill" href={market.sourceUrl} target="_blank" rel="noreferrer">
                          <ExternalLink size={13} /> Source market
                        </a>
                      ) : null}
                    </article>
                  ))}
                </div>
                );
              })}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function formatProbability(value: number | null): string {
  return value === null ? "n/a" : `${Math.round(value * 100)}%`;
}

function formatNumber(value: number | null): string {
  if (value === null) return "n/a";
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function qualityFlags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((flag): flag is string => typeof flag === "string") : [];
}
