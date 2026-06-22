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
        <span className="muted">{formatTimestamp(forecast.latestComposite?.createdAt)}</span>
      </header>
      <section className="terminal">
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28 }}>{forecast.title}</h1>
          <p className="muted" style={{ margin: 0 }}>{forecast.description}</p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            This page reads the latest processed forecast cache and its source-market audit trail.
          </p>
        </div>

        <div className="detailGrid">
          <section className="panel">
            <div className="panelHeader">
              <h2>Composite Forecast</h2>
              <span className="prob">{formatProbability(forecast.current?.compositeValue ?? forecast.latestComposite?.compositeValue ?? null)}</span>
            </div>
            <div style={{ padding: "0 12px 8px", fontSize: "12px", color: "var(--muted)" }}>
              This value is precomputed by the processing worker from deterministic cluster membership, market quality, and recency.
            </div>
            <div className="panelBody">
              <ForecastChart
                compositeData={forecast.compositeHistory}
                series={forecast.topMarketSeries || []}
              />
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                Composite = quality + recency weighted average (or max for mutually-exclusive races) across linked markets.
                The frontend does not compute this value; it reads the cached worker output.
              </p>
              {Array.isArray(forecast.current?.sourceBreakdown) && forecast.current.sourceBreakdown.length > 0 && (
                <div style={{marginTop:8, fontSize:11}}>
                  <strong>Top contributors:</strong> {forecast.current.sourceBreakdown.slice(0,3).map((b:any,i:number) => (
                    <span key={i} style={{marginRight:8}}>{(b.question||'').slice(0,30)} (+{(b.contribution||0)*100|0}pp)</span>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <h2>Source Breakdown</h2>
              <span className="pill">{forecast.markets.length} markets</span>
            </div>
            {Array.isArray(forecast.current?.sourceBreakdown) && forecast.current.sourceBreakdown.length > 0 && (
              <div style={{padding: '4px 12px', fontSize: '11px', color: 'var(--muted)'}}>
                Using composite contributions (weights from quality+recency).
              </div>
            )}

            <div style={{ padding: "8px 12px", fontSize: 13, border: "1px solid #2a3a2f", margin: "8px", borderRadius: 4 }}>
              <div><strong>COMPOSITE PROBABILITY:</strong> {formatProbability(forecast.current?.compositeValue ?? null)}</div>
              <div style={{ marginTop: 6 }}><strong>DETERMINISTIC SOURCE CONTRIBUTIONS:</strong></div>
              {Array.isArray(forecast.current?.sourceBreakdown) && forecast.current.sourceBreakdown.length > 0 ? (
                forecast.current.sourceBreakdown.slice(0, 5).map((b: any, i: number) => (
                  <div key={i} style={{ marginLeft: 8, fontSize: 12 }}>
                    [{(b.question || "").slice(0, 50)}] - {(b.probability * 100).toFixed(1)}% 
                    (Weight: {(b.weight || 0).toFixed(2)} | Contrib: +{((b.contribution || 0) * 100).toFixed(1)}pp)
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 12, marginLeft: 8 }}>No detailed token breakdown available.</div>
              )}
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
                          {market.warnings.map((warning: any) => <li key={warning.id}>{warning.message}</li>)}
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
