import { PrismaClient } from "@prisma/client";
import { seedClusters } from "@/lib/config/clusters";

const prisma = new PrismaClient();

async function main() {
  for (const cluster of seedClusters) {
    await prisma.forecastCluster.upsert({
      where: { slug: cluster.slug },
      create: {
        slug: cluster.slug,
        title: cluster.title,
        category: cluster.category,
        description: cluster.description,
        isSeed: true
      },
      update: {
        title: cluster.title,
        category: cluster.category,
        description: cluster.description,
        isSeed: true
      }
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
