import { PrismaClient } from "@prisma/client";
import { seedClusters } from "@/ensemble/config/clusters";

const prisma = new PrismaClient();

async function main() {
  const activeSlugs = seedClusters.map((cluster) => cluster.slug);
  await prisma.forecastCluster.deleteMany({ where: { slug: { notIn: activeSlugs } } });
  for (const cluster of seedClusters) {
    await prisma.forecastCluster.upsert({
      where: { slug: cluster.slug },
      create: { slug: cluster.slug, title: cluster.title, category: cluster.category, description: cluster.description },
      update: { title: cluster.title, category: cluster.category, description: cluster.description }
    });
  }
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
