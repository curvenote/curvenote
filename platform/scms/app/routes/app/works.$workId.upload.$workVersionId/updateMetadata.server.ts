import { getPrismaClient } from '@curvenote/scms-server';
import { data } from 'react-router';

/**
 * Update the work version title field directly
 */
export async function updateWorkVersionTitle(workVersionId: string, title: string) {
  try {
    const prisma = await getPrismaClient();

    await prisma.workVersion.update({
      where: { id: workVersionId },
      data: {
        title,
        date_modified: new Date().toISOString(),
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error('Failed to update work version title:', error);
    return data(
      {
        error: {
          type: 'general',
          message: 'Failed to update title',
          details: { workVersionId, error: error.message },
        },
      },
      { status: 500 },
    );
  }
}

/**
 * Update the work version authors array (comma-separated string parsed to list)
 */
export async function updateWorkVersionAuthors(workVersionId: string, authorsText: string) {
  try {
    const prisma = await getPrismaClient();
    const authors = authorsText
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    await prisma.workVersion.update({
      where: { id: workVersionId },
      data: {
        authors,
        date_modified: new Date().toISOString(),
      },
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to update work version authors:', error);
    return data(
      {
        error: {
          type: 'general',
          message: 'Failed to update authors',
          details: { workVersionId, error: message },
        },
      },
      { status: 500 },
    );
  }
}
