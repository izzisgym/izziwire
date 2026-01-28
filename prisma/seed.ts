import { PrismaClient } from '@prisma/client';
import { allSources } from '../src/scraper/sources/index.js';

const prisma = new PrismaClient();

async function main() {
  for (const s of allSources) {
    const existing = await prisma.newsSource.findFirst({
      where: { url: s.url, game: s.game },
    });
    if (existing) {
      await prisma.newsSource.update({
        where: { id: existing.id },
        data: {
          name: s.name,
          sourceType: s.sourceType,
          rssFeedUrl: s.rssFeedUrl ?? null,
          scrapeSelector: s.scrapeSelector ?? undefined,
          priority: s.priority,
        },
      });
    } else {
      await prisma.newsSource.create({
        data: {
          name: s.name,
          game: s.game,
          sourceType: s.sourceType,
          url: s.url,
          rssFeedUrl: s.rssFeedUrl ?? null,
          scrapeSelector: s.scrapeSelector ?? undefined,
          isActive: true,
          priority: s.priority,
        },
      });
    }
  }
  console.log(`Seeded ${allSources.length} news sources.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
