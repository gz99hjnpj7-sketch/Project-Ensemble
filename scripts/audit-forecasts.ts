import { getForecastDashboard } from "@/ensemble/serving/read-models";
import { prisma } from "@/ensemble/db/prisma";

function pct(value: number | null | undefined): string {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "n/a";
}

function points(value: number | null | undefined): string {
  if (typeof value !== "number") return "n/a";
  const asPoints = value * 100;
  const sign = asPoints > 0 ? "+" : "";
  return `${sign}${asPoints.toFixed(Math.abs(asPoints) < 1 ? 1 : 0)} pts`;
}

async function main() {
  const [dashboard, latestRun] = await Promise.all([
    getForecastDashboard(),
    prisma.ingestionRun.findFirst({ orderBy: { startedAt: "desc" } })
  ]);

  console.log("Latest ingestion:");
  console.log(JSON.stringify(latestRun ? {
    status: latestRun.status,
    marketsFetched: latestRun.marketsFetched,
    compositesUpdated: latestRun.compositesUpdated,
    errors: latestRun.errors
  } : null, null, 2));

  console.log("\nForecast audit:");
  for (const forecast of dashboard.forecasts as any[]) {
    const supporting = forecast.sources.filter((source: any) => source.sourceRole === "supporting").length;
    const headline = forecast.sources.filter((source: any) => source.sourceRole === "headline");
    console.log(`\n- ${forecast.title}`);
    console.log(`  composite=${pct(forecast.compositeProbability)} confidence=${forecast.confidence} quality=${forecast.qualityScore}`);
    console.log(`  headline=${forecast.futureNews.headline}`);
    console.log(`  movement=${points(forecast.movement?.sinceFirst?.probability)} since first (${forecast.movement?.pointCount ?? 0} comparable runs)`);
    console.log(`  headlineSources=${headline.length} supportingSources=${supporting}`);
    if (forecast.outcomeBreakdown?.length) {
      console.log(`  outcomeBreakdown=${forecast.outcomeBreakdown.map((outcome: any) => `${outcome.name} ${pct(outcome.probability)}`).join(", ")}`);
    }
    if (headline[0]) {
      console.log(`  topSource=${headline[0].question}`);
      console.log(`  topSourceUrl=${headline[0].sourceUrl ?? "n/a"}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
