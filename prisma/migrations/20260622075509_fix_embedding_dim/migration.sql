-- AlterTable
ALTER TABLE "ForecastCluster" ADD COLUMN     "embedding" vector(3072);

-- AlterTable
ALTER TABLE "NormalizedMarket" ADD COLUMN     "embedding" vector(3072);
