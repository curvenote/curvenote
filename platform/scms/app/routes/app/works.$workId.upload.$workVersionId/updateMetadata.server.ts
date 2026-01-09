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
