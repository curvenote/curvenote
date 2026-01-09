import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    const kinds = await tx.submissionKind.findMany({
      include: { site: { select: { name: true } } },
    });
    for (const kind of kinds) {
      if (
        (kind.site.name === 'agu' && kind.name === 'Original') ||
        (kind.site.name === 'agrogeo24' && kind.name === 'Abstract') ||
        (kind.site.name === 'betterscience' && kind.name === 'Post') ||
        (kind.site.name === 'earthcube' && kind.name === 'Original') ||
        (kind.site.name === 'finance' && kind.name === 'Report') ||
        (kind.site.name === 'microscopy' && kind.name === 'Book') ||
        (kind.site.name === 'newscience' && kind.name === 'Article') ||
        (kind.site.name === 'physiome' && kind.name === 'Original Research') ||
        (kind.site.name === 'plos' && kind.name === 'Original') ||
        (kind.site.name === 'scipy' && kind.name === 'Article') ||
        (kind.site.name === 'tellus' && kind.name === 'Project')
      ) {
        await tx.submissionKind.update({
          where: { id: kind.id },
          data: {
            default: true,
          },
        });
      }
    }
  });
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
