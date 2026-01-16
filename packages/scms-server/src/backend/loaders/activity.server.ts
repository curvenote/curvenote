import { uuidv7 } from 'uuidv7';
import { getPrismaClient } from '../prisma.server.js';
import type { $Enums } from '@curvenote/scms-db';

export interface LogActivityData {
  activityBy: string;
  activityType: $Enums.ActivityType;
  submissionId?: string;
  submissionVersionId?: string;
  kindId?: string;
  collectionId?: string;
  workId?: string;
  workVersionId?: string;
  siteId?: string;
  userId?: string;
  accessId?: string;
  roleId?: string;
  userRoleId?: string;
  status?: string;
  transition?: any;
  datePublished?: string;
}

/**
 * Log an activity in the database
 */
export async function logActivity(data: LogActivityData): Promise<void> {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();

  await prisma.activity.create({
    data: {
      id: uuidv7(),
      date_created: now,
      date_modified: now,
      activity_by_id: data.activityBy,
      activity_type: data.activityType,
      submission_id: data.submissionId,
      submission_version_id: data.submissionVersionId,
      kind_id: data.kindId,
      collection_id: data.collectionId,
      work_id: data.workId,
      work_version_id: data.workVersionId,
      site_id: data.siteId,
      user_id: data.userId,
      access_id: data.accessId,
      role_id: data.roleId,
      user_role_id: data.userRoleId,
      status: data.status,
      transition: data.transition,
      date_published: data.datePublished,
    },
  });
}

/**
 * Log role-related activities
 */
export async function logRoleActivity(
  activityBy: string,
  activityType: 'ROLE_CREATED' | 'ROLE_UPDATED' | 'ROLE_DELETED',
  roleId: string,
): Promise<void> {
  await logActivity({
    activityBy,
    activityType,
    roleId,
  });
}

/**
 * Log user role assignment activities
 */
export async function logUserRoleActivity(
  activityBy: string,
  activityType: 'ROLE_ASSIGNED' | 'ROLE_REMOVED',
  userRoleId: string,
  userId: string,
  roleId: string,
): Promise<void> {
  await logActivity({
    activityBy,
    activityType,
    userRoleId,
    userId,
    roleId,
  });
}
