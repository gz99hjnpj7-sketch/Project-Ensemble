import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/ensemble/db/prisma";

export async function checkForecastCurrentCache(db: PrismaClient = defaultPrisma) {
  const currents = await db.forecastCurrent.findMany({ include: { cluster: { include: { compositeForecasts: { orderBy: { computedAt: "desc" }, take: 1 } } } } });
  return currents.map((current) => {
    const latest = current.cluster.compositeForecasts[0] ?? null;
    return { clusterId: current.clusterId, ok: latest?.id === current.latestCompositeId && latest?.compositeProbability === current.compositeProbability, currentCompositeId: current.latestCompositeId, rebuiltCompositeId: latest?.id ?? null };
  });
}
