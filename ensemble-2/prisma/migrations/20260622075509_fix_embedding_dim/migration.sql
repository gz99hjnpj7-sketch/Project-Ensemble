-- AlterTable
ALTER TABLE "ForecastCluster" ADD COLUMN     "embedding" JSONB;

-- AlterTable
ALTER TABLE "NormalizedMarket" ADD COLUMN     "embedding" JSONB;
