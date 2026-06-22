import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { ForecastChart } from "@/components/ForecastChart";
import { getForecastDetail } from "@/lib/forecast/read-models";

export default async function ForecastDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forecast = await getForecastDetail(id);
  if (!forecast) notFound();

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <Link href="/">Future News</Link>
          <span>{forecast.category}</span>
        </div>
        <span className="muted">{forecast.latestComposite ? new Date(forecast.latestComposite.computedAt).toLocaleString() : "No composite yet"}</span>
      </header>
      <section className="terminal">
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28 }}>{forecast.title}</h1>
          <p className="muted" style={{ margin: 0 }}>{forecast.description}</p>
        </div>

        <div className="detailGrid">
          <section className="panel">
            <div className="panelHeader">
              <h2>Composite Forecast</h2>
              <span className="prob">{formatProbability(forecast.latestComposite?.compositeProbability ?? null)}</span>
            </div>
            <div className="panelBody">
              <ForecastChart data={forecast.compositeHistory} />
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <h2>Source Breakdown</h2>
              <span className="pill">{forecast.markets.length} markets</span>
            </div>
            <div className="panelBody marketList">
              {forecast.markets.map((market) => (
                <article className="marketItem" key={market.id}>
                  <div>
                    <strong>{market.question}</strong>
                    <div className="muted">{market.sourcePlatform}</div>
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
