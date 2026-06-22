import { runIngestion } from "@/ensemble/ingestion/run";

const intervalMinutes = Number(process.env.INGEST_INTERVAL_MINUTES ?? 30);
const intervalMs = intervalMinutes * 60_000;

async function tick() {
  const startedAt = new Date();
  console.log(`[ingest] starting ${startedAt.toISOString()}`);
  try {
    const summary = await runIngestion({ now: startedAt });
    console.log(`[ingest] completed ${JSON.stringify(summary)}`);
  } catch (error) {
    console.error("[ingest] failed", error);
  }
}

void tick();
setInterval(tick, intervalMs);
