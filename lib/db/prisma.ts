import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Ensures pgvector extension is available (safe to call multiple times).
 * Also defensively ensures embedding columns exist.
 * Call during ingestion startup or app boot in dev.
 */
export async function ensureVectorExtension(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[prisma] Could not ensure vector extension (may already exist or no perms):", (e as Error).message);
    }
  }

  // Add columns if the schema was updated without a full migration
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "NormalizedMarket" ADD COLUMN IF NOT EXISTS embedding vector(3072);`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "ForecastCluster" ADD COLUMN IF NOT EXISTS embedding vector(3072);`
    );
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      // Expected if column exists
    }
  }
}
