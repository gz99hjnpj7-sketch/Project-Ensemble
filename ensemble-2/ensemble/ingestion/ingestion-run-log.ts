import type { IngestionRunStatus, Prisma, PrismaClient } from "@prisma/client";

export type IngestionCounters = {
  connectorResults: Array<{ sourcePlatform: string; fetched: number; errors: string[] }>;
  errors: string[];
  marketsFetched: number;
  marketsUpserted: number;
  snapshotsWritten: number;
  matchDecisionsWritten: number;
  compositesUpdated: number;
  warningsWritten: number;
};

export async function createIngestionRun(db: PrismaClient) {
  return db.ingestionRun.create({ data: { connectorResults: [], errors: [] } });
}

export async function finishIngestionRun(db: PrismaClient, runId: string, counters: IngestionCounters, status: IngestionRunStatus) {
  return db.ingestionRun.update({
    where: { id: runId },
    data: { finishedAt: new Date(), status, connectorResults: counters.connectorResults as Prisma.InputJsonValue, errors: counters.errors as Prisma.InputJsonValue, marketsFetched: counters.marketsFetched, marketsUpserted: counters.marketsUpserted, snapshotsWritten: counters.snapshotsWritten, matchDecisionsWritten: counters.matchDecisionsWritten, compositesUpdated: counters.compositesUpdated, warningsWritten: counters.warningsWritten }
  });
}
