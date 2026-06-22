CREATE TYPE "IngestionRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');
CREATE TYPE "MatchMethod" AS ENUM ('DETERMINISTIC', 'SEMANTIC');
CREATE TYPE "MatchOutcome" AS ENUM ('MATCHED', 'UNMATCHED');
CREATE TYPE "ConfidenceBand" AS ENUM ('TIGHT', 'NORMAL', 'WIDE');

ALTER TABLE "MarketSnapshot" ADD COLUMN "ingestionRunId" TEXT;
ALTER TABLE "CompositeForecast" ADD COLUMN "confidenceBand" "ConfidenceBand" NOT NULL DEFAULT 'NORMAL';

CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "IngestionRunStatus" NOT NULL DEFAULT 'RUNNING',
    "connectorResults" JSONB NOT NULL,
    "errors" JSONB NOT NULL,
    "marketsFetched" INTEGER NOT NULL DEFAULT 0,
    "marketsUpserted" INTEGER NOT NULL DEFAULT 0,
    "snapshotsWritten" INTEGER NOT NULL DEFAULT 0,
    "matchDecisionsWritten" INTEGER NOT NULL DEFAULT 0,
    "compositesUpdated" INTEGER NOT NULL DEFAULT 0,
    "warningsWritten" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ForecastCurrent" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "latestCompositeId" TEXT,
    "compositeProbability" DOUBLE PRECISION,
    "confidence" "SignalConfidence" NOT NULL DEFAULT 'LOW',
    "confidenceBand" "ConfidenceBand" NOT NULL DEFAULT 'NORMAL',
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "sourceBreakdown" JSONB NOT NULL,
    "policy" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ForecastCurrent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatchDecision" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "clusterId" TEXT,
    "outcome" "MatchOutcome" NOT NULL,
    "method" "MatchMethod" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketSnapshot_ingestionRunId_idx" ON "MarketSnapshot"("ingestionRunId");
CREATE INDEX "IngestionRun_startedAt_idx" ON "IngestionRun"("startedAt");
CREATE INDEX "IngestionRun_status_idx" ON "IngestionRun"("status");
CREATE UNIQUE INDEX "ForecastCurrent_clusterId_key" ON "ForecastCurrent"("clusterId");
CREATE INDEX "ForecastCurrent_confidence_idx" ON "ForecastCurrent"("confidence");
CREATE INDEX "ForecastCurrent_updatedAt_idx" ON "ForecastCurrent"("updatedAt");
CREATE INDEX "MatchDecision_marketId_observedAt_idx" ON "MatchDecision"("marketId", "observedAt");
CREATE INDEX "MatchDecision_clusterId_observedAt_idx" ON "MatchDecision"("clusterId", "observedAt");
CREATE INDEX "MatchDecision_outcome_idx" ON "MatchDecision"("outcome");

ALTER TABLE "MarketSnapshot" ADD CONSTRAINT "MarketSnapshot_ingestionRunId_fkey" FOREIGN KEY ("ingestionRunId") REFERENCES "IngestionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ForecastCurrent" ADD CONSTRAINT "ForecastCurrent_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "ForecastCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchDecision" ADD CONSTRAINT "MatchDecision_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "NormalizedMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchDecision" ADD CONSTRAINT "MatchDecision_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "ForecastCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
