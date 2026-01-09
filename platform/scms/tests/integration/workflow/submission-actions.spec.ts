/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, beforeEach } from 'vitest';
import type { SiteRole } from '@prisma/client';
import { getPrismaClient, sites } from '@curvenote/scms-server';
import { createTestData, type TestData } from '../helpers/mocks';
import { setupVercelMocks } from '../helpers/mock-vercel';
import { setupMockStorage } from '../helpers/mock-storage';
import type { Config } from '@/types/app-config';
import type { Workflow } from '@curvenote/scms-core';
import { getWorkflowNames, getWorkflows } from '@curvenote/scms-core';
import { uuidv7 } from 'uuidv7';

describe('Submission Actions Integration', () => {
  let testData: TestData;
  let config: Config;
  let workflows: Record<string, Workflow>;
  let workflowNamesList: string[];

  beforeEach(async () => {
    testData = await createTestData('ADMIN' as SiteRole);
    setupVercelMocks();
    setupMockStorage();

    // Create minimal config for workflow testing
    config = {
      app: {
        extensions: {},
      },
    } as Config;

    // Get workflows and names
    workflows = getWorkflows(config, []);
    workflowNamesList = getWorkflowNames(config, []);
  });

  describe('Simple Public Workflow', () => {
    beforeEach(async () => {
      // Update the site to use the simple workflow
      const prisma = await getPrismaClient();
      const simpleWorkflowName = workflowNamesList.find((name) => name === 'SIMPLE');
      if (!simpleWorkflowName) throw new Error('SIMPLE workflow not found');

      await prisma.site.update({
        where: { id: testData.siteId },
        data: { default_workflow: simpleWorkflowName },
      });
      testData.context.site.default_workflow = simpleWorkflowName;
    });

    test('Submission in published state has unpublish action available', async () => {
      // Create a submission version in published state
      const prisma = await getPrismaClient();
      await prisma.submissionVersion.create({
        data: {
          id: uuidv7(),
          date_created: new Date().toISOString(),
          date_modified: new Date().toISOString(),
          status: 'PUBLISHED',
          submission: { connect: { id: testData.submissionId } },
          work_version: { connect: { id: testData.workVersionId } },
          submitted_by: { connect: { id: testData.userId } },
        },
      });

      // Get the submission and check its links
      const submission = await sites.submissions.get(testData.context, testData.submissionId, []);

      expect(submission.links.unpublish).toBeDefined();
      expect(submission.links.publish).toBeUndefined();
    });

    test('Submission in PENDING state has publish action available', async () => {
      // Create a submission version in unpublished state
      const prisma = await getPrismaClient();
      await prisma.submissionVersion.create({
        data: {
          id: uuidv7(),
          date_created: new Date().toISOString(),
          date_modified: new Date().toISOString(),
          status: 'PENDING',
          submission: { connect: { id: testData.submissionId } },
          work_version: { connect: { id: testData.workVersionId } },
          submitted_by: { connect: { id: testData.userId } },
        },
      });

      // Get the submission and check its links
      const submission = await sites.submissions.get(testData.context, testData.submissionId, []);

      expect(submission.links.publish).toBeDefined();
      expect(submission.links.unpublish).toBeUndefined();
    });

    test('Submission in state with no valid transitions has no actions available', async () => {
      // Create a submission version in a state with no valid transitions
      const prisma = await getPrismaClient();
      await prisma.submissionVersion.create({
        data: {
          id: uuidv7(),
          date_created: new Date().toISOString(),
          date_modified: new Date().toISOString(),
          status: 'REJECTED',
          submission: { connect: { id: testData.submissionId } },
          work_version: { connect: { id: testData.workVersionId } },
          submitted_by: { connect: { id: testData.userId } },
        },
      });

      // Get the submission and check its links
      const submission = await sites.submissions.get(testData.context, testData.submissionId, []);

      expect(submission.links.publish).toBeUndefined();
      expect(submission.links.unpublish).toBeUndefined();
    });

    test('Submission in UNPUBLISHED state has no actions available', async () => {
      // Create a submission version in UNPUBLISHED state
      const prisma = await getPrismaClient();
      await prisma.submissionVersion.create({
        data: {
          id: uuidv7(),
          date_created: new Date().toISOString(),
          date_modified: new Date().toISOString(),
          status: 'UNPUBLISHED',
          submission: { connect: { id: testData.submissionId } },
          work_version: { connect: { id: testData.workVersionId } },
          submitted_by: { connect: { id: testData.userId } },
        },
      });

      // Get the submission and check its links
      const submission = await sites.submissions.get(testData.context, testData.submissionId, []);

      expect(submission.links.publish).toBeUndefined();
      expect(submission.links.unpublish).toBeUndefined();
    });
  });
});
