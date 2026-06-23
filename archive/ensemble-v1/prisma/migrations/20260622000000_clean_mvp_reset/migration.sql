-- CreateEnum
CREATE TYPE "SourcePlatform" AS ENUM ('POLYMARKET', 'KALSHI', 'MANIFOLD');

-- CreateEnum
CREATE TYPE "ForecastCategory" AS ENUM ('POLITICS', 'MACRO', 'CRYPTO', 'WORLD', 'OTHER');

-- CreateEnum
CREATE TYPE "OutcomeType" AS ENUM ('BINARY', 'MULTIPLE_CHOICE', 'SCALAR');

-- CreateEnum
CREATE TYPE "ResolutionStatus" AS ENUM ('OPEN', 'RESOLVED', 'CLOSED', 'CANCELLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SignalConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "WarningType" AS ENUM ('LARGE_MOVE', 'LOW_LIQUIDITY_MOVE', 'WIDE_SPREAD', 'STALE_MARKET');

-- CreateEnum
CREATE TYPE "IngestionRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "sourcePlatform" "SourcePlatform" NOT NULL,
    "status" "IngestionRunStatus" NOT NULL DEFAULT 'RUNNING',
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "upsertedCount" INTEGER NOT NULL DEFAULT 0,
    "snapshotCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormalizedMarket" (
    "id" TEXT NOT NULL,
    "sourcePlatform" "SourcePlatform" NOT NULL,
    "sourceMarketId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceSlug" TEXT,
    "question" TEXT NOT NULL,
    "marketType" TEXT NOT NULL DEFAULT 'BINARY',
    "eventTitle" TEXT NOT NULL,
    "category" "ForecastCategory" NOT NULL DEFAULT 'OTHER',
    "outcomeType" "OutcomeType" NOT NULL DEFAULT 'BINARY',
    "outcomes" JSONB NOT NULL,
    "currentProbability" DOUBLE PRECISION,
    "bid" DOUBLE PRECISION,
    "ask" DOUBLE PRECISION,
    "midpoint" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "liquidity" DOUBLE PRECISION,
    "openInterest" DOUBLE PRECISION,
    "tradeCount" INTEGER,
    "participantCount" INTEGER,
    "closeTime" TIMESTAMP(3),
    "resolutionStatus" "ResolutionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "sourceUrl" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NormalizedMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "sourcePlatform" "SourcePlatform" NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentProbability" DOUBLE PRECISION,
    "bid" DOUBLE PRECISION,
    "ask" DOUBLE PRECISION,
    "midpoint" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "liquidity" DOUBLE PRECISION,
    "openInterest" DOUBLE PRECISION,
    "tradeCount" INTEGER,
    "participantCount" INTEGER,
    "rawPayload" JSONB NOT NULL,

    CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastCluster" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "ForecastCategory" NOT NULL,
    "description" TEXT,
    "isSeed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForecastCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClusterMarket" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "sourcePlatform" "SourcePlatform" NOT NULL,
    "relationship" TEXT NOT NULL DEFAULT 'deterministic',
    "weightOverride" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClusterMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketQualityScore" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "confidence" "SignalConfidence" NOT NULL,
    "flags" JSONB NOT NULL,
    "liquidityScore" DOUBLE PRECISION NOT NULL,
    "spreadScore" DOUBLE PRECISION NOT NULL,
    "volumeScore" DOUBLE PRECISION NOT NULL,
    "recencyScore" DOUBLE PRECISION NOT NULL,
    "marketAgeScore" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketQualityScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompositeForecast" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "compositeValue" DOUBLE PRECISION,
    "confidenceScore" DOUBLE PRECISION,
    "sourceBreakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompositeForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastCurrent" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "compositeValue" DOUBLE PRECISION,
    "confidence" "SignalConfidence" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "marketCount" INTEGER NOT NULL,
    "warningCount" INTEGER NOT NULL,
    "move24h" DOUBLE PRECISION,
    "sourceBreakdown" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForecastCurrent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalWarning" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "sourcePlatform" "SourcePlatform" NOT NULL,
    "type" "WarningType" NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "SignalConfidence" NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "SignalWarning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IngestionRun_sourcePlatform_startedAt_idx" ON "IngestionRun"("sourcePlatform", "startedAt");
CREATE INDEX "IngestionRun_status_idx" ON "IngestionRun"("status");
CREATE UNIQUE INDEX "NormalizedMarket_sourcePlatform_sourceId_key" ON "NormalizedMarket"("sourcePlatform", "sourceId");
CREATE INDEX "NormalizedMarket_sourcePlatform_sourceSlug_idx" ON "NormalizedMarket"("sourcePlatform", "sourceSlug");
CREATE INDEX "NormalizedMarket_category_idx" ON "NormalizedMarket"("category");
CREATE INDEX "NormalizedMarket_lastUpdated_idx" ON "NormalizedMarket"("lastUpdated");
CREATE INDEX "MarketSnapshot_marketId_observedAt_idx" ON "MarketSnapshot"("marketId", "observedAt");
CREATE INDEX "MarketSnapshot_sourcePlatform_observedAt_idx" ON "MarketSnapshot"("sourcePlatform", "observedAt");
CREATE UNIQUE INDEX "ForecastCluster_slug_key" ON "ForecastCluster"("slug");
CREATE INDEX "ClusterMarket_sourcePlatform_idx" ON "ClusterMarket"("sourcePlatform");
CREATE UNIQUE INDEX "ClusterMarket_clusterId_marketId_key" ON "ClusterMarket"("clusterId", "marketId");
CREATE INDEX "MarketQualityScore_marketId_computedAt_idx" ON "MarketQualityScore"("marketId", "computedAt");
CREATE INDEX "CompositeForecast_clusterId_createdAt_idx" ON "CompositeForecast"("clusterId", "createdAt");
CREATE UNIQUE INDEX "ForecastCurrent_clusterId_key" ON "ForecastCurrent"("clusterId");
CREATE INDEX "ForecastCurrent_confidence_idx" ON "ForecastCurrent"("confidence");
CREATE INDEX "ForecastCurrent_processedAt_idx" ON "ForecastCurrent"("processedAt");
CREATE INDEX "SignalWarning_marketId_observedAt_idx" ON "SignalWarning"("marketId", "observedAt");
CREATE INDEX "SignalWarning_type_idx" ON "SignalWarning"("type");

-- AddForeignKey
ALTER TABLE "MarketSnapshot" ADD CONSTRAINT "MarketSnapshot_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "NormalizedMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClusterMarket" ADD CONSTRAINT "ClusterMarket_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "ForecastCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClusterMarket" ADD CONSTRAINT "ClusterMarket_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "NormalizedMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketQualityScore" ADD CONSTRAINT "MarketQualityScore_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "NormalizedMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompositeForecast" ADD CONSTRAINT "CompositeForecast_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "ForecastCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForecastCurrent" ADD CONSTRAINT "ForecastCurrent_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "ForecastCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SignalWarning" ADD CONSTRAINT "SignalWarning_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "NormalizedMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
