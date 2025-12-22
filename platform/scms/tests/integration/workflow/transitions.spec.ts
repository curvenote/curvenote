/* eslint-disable import/no-extraneous-dependencies */
import { describe, test, expect, beforeEach } from 'vitest';
import type { SiteRole } from '@prisma/client';
import { getPrismaClient, sites, jobs, registerExtensionJobs } from '@curvenote/scms-server';
import {
  KnownJobTypes,
  getValidTransition,
  getWorkflowNames,
  getWorkflows,
} from '@curvenote/scms-core';
import { createTestData, type TestData } from '../helpers/mocks';
import { setupVercelMocks } from '../helpers/mock-vercel';
import { verifyJobCall } from '../helpers/verify-jobs';
import type { WorkflowTransition, Workflow } from '@curvenote/scms-core';
import type { StorageBackend } from '@curvenote/scms-server';
import { setupMockStorage, getMockStorageBackend } from '../helpers/mock-storage';
import { uuidv7 } from 'uuidv7';
import type { Config } from '@/types/app-config';
import { extensions } from '../../../app/extensions/server';

describe('Workflow Transitions Integration', () => {
  let testData: TestData;
  let config: Config;
  let workflows: Record<string, Workflow>;
  let workflowNamesList: string[];
  let handlers: Record<string, jobs.JobHandler>;

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
    handlers = await jobs.getHandlers(registerExtensionJobs(extensions));
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

    test('New submission versions get the correct initial state', async () => {
      const submission = await sites.submissions.versions.create(
        testData.context,
        [],
        testData.submissionId,
        testData.workVersionId,
      );
      const simpleWorkflow = workflows['SIMPLE'];
      expect(submission.status).toBe(simpleWorkflow.initialState);
    });

    test('Invalid Transition - PENDING => DRAFT', async () => {
      const dto = await sites.submissions.versions.create(
        testData.context,
        [],
        testData.submissionId,
        testData.workVersionId,
      );

      const submissionVersion =
        await sites.submissions.versions.dbGetLatestSubmissionVersionFromSubmission(
          testData.context.site.name,
          dto.submission_id,
        );

      expect(submissionVersion).not.toBeNull();

      await expect(async () => {
        await sites.submissions.versions.transition(
          testData.context,
          submissionVersion!,
          workflows['SIMPLE'],
          'DRAFT',
          '2025-05-14',
        );
      }).rejects.toThrow(
        expect.objectContaining({
          statusText: 'Cannot transition from PENDING to DRAFT',
        }),
      );
    });

    test('Immediate Transition - PENDING => REJECTED', async () => {
      const dto = await sites.submissions.versions.create(
        testData.context,
        [],
        testData.submissionId,
        testData.workVersionId,
      );

      const submissionVersion =
        await sites.submissions.versions.dbGetLatestSubmissionVersionFromSubmission(
          testData.context.site.name,
          dto.submission_id,
        );

      expect(submissionVersion).not.toBeNull();

      const updated = (await sites.submissions.versions.transition(
        testData.context,
        submissionVersion!,
        workflows['SIMPLE'],
        'REJECTED',
        '1970-01-01',
      )) as any;

      expect(updated.status).toEqual('REJECTED');
      expect(updated.date_published).toBeNull(); // this transition does not set the date_published
    });

    test('Start Job Based Transition - PENDING => PUBLISHED', async () => {
      const dto = await sites.submissions.versions.create(
        testData.context,
        [],
        testData.submissionId,
        testData.workVersionId,
      );

      expect(dto.status).toEqual('PENDING');

      const submissionVersion =
        await sites.submissions.versions.dbGetLatestSubmissionVersionFromSubmission(
          testData.context.site.name,
          dto.submission_id,
        );

      expect(submissionVersion).not.toBeNull();

      const updated = (await sites.submissions.versions.transition(
        testData.context,
        submissionVersion!,
        workflows['SIMPLE'],
        'PUBLISHED',
        '2025-05-14',
      )) as any;

      // Verify the jobs endpoint was called with correct parameters
      verifyJobCall({
        jobType: KnownJobTypes.PUBLISH,
        siteId: testData.siteId,
        userId: testData.userId,
        submissionVersionId: updated.id,
        cdn: submissionVersion!.work_version.cdn || 'https://test-cdn.com',
        key: submissionVersion!.work_version.cdn_key || 'test-key',
        datePublished: '2025-05-14',
      });
    });

    test('successful publish job updates the submission version status to PUBLISHED and clears the transition', async () => {
      // Create initial submission version
      const dto = await sites.submissions.versions.create(
        testData.context,
        [],
        testData.submissionId,
        testData.workVersionId,
      );
      expect(dto.status).toEqual('PENDING');

      // Create a real job for publishing, this would have been done at the start of the transition
      const prisma = await getPrismaClient();

      // Create a stateful transition with a jobId (mimicking what startJobBasedTransition does)
      const jobId = uuidv7();
      const baseTransition = getValidTransition(workflows['SIMPLE'], 'PENDING', 'PUBLISHED');
      const statefulTransition = {
        ...baseTransition,
        state: {
          ...baseTransition?.state,
          jobId,
        },
      };

      // Update submission version with transition
      const updated = await prisma.submissionVersion.update({
        where: { id: dto.id },
        data: {
          transition: statefulTransition,
        },
      });
      const transition = updated.transition as WorkflowTransition;

      expect(transition).toBeDefined();
      expect(transition.state?.jobId).toBeDefined();

      // Set up storage mocks for successful publishing
      const storageBackend = getMockStorageBackend();
      storageBackend.folder.exists.mockResolvedValue(true);
      storageBackend.folder.copy.mockResolvedValue(undefined);

      // Execute the publish job handler
      const publishJobHandler = handlers['PUBLISH'];
      await publishJobHandler(
        testData.context,
        {
          id: transition.state?.jobId,
          job_type: 'PUBLISH',
          payload: {
            submission_version_id: dto.id,
            site_id: testData.siteId,
            user_id: testData.userId,
            cdn: 'https://test-cdn.com',
            key: uuidv7(),
            date_published: '2025-05-14',
            updates_slug: true,
          },
        },
        storageBackend as unknown as StorageBackend,
      );

      // Verify final state
      const final = await prisma.submissionVersion.findUnique({
        where: { id: dto.id },
        include: {
          job: true,
        },
      });
      expect(final).not.toBeNull();
      if (!final) return;

      expect(final.status).toEqual('PUBLISHED');
      expect(final.transition).toBeNull();

      const job = await prisma.job.findUnique({
        where: { id: transition.state?.jobId },
      });

      expect(job).not.toBeNull();
      if (!job) return;

      expect(job.status).toEqual('COMPLETED');
      expect(job.results).toEqual({
        files_transfered: true,
        submission_updated: true,
        date_published_updated: true,
        slug_updated: true,
      });
    });

    test('successful unpublish job updates the submission version status to UNPUBLISHED and clears the transition', async () => {
      // Create initial submission version
      const dto = await sites.submissions.versions.create(
        testData.context,
        [],
        testData.submissionId,
        testData.workVersionId,
      );
      expect(dto.status).toEqual('PENDING');

      // Create a real job for unpublishing, this would have been done at the start of the transition
      const prisma = await getPrismaClient();

      // Create a stateful transition with a jobId (mimicking what startJobBasedTransition does)
      const jobId = uuidv7();
      const baseTransition = getValidTransition(workflows['SIMPLE'], 'PUBLISHED', 'UNPUBLISHED');
      const statefulTransition = {
        ...baseTransition,
        state: {
          ...baseTransition?.state,
          jobId,
        },
      };

      // Update submission version with transition
      const updated = await prisma.submissionVersion.update({
        where: { id: dto.id },
        data: {
          transition: statefulTransition,
        },
      });
      const transition = updated.transition as WorkflowTransition;
      expect(transition).toBeDefined();
      expect(transition.state?.jobId).toBeDefined();

      // Set up storage mocks for successful unpublishing
      const storageBackend = getMockStorageBackend();
      storageBackend.folder.exists.mockResolvedValue(true);
      storageBackend.folder.delete.mockResolvedValue(undefined);

      // Execute the unpublish job handler
      const unpublishJobHandler = handlers['UNPUBLISH'];
      await unpublishJobHandler(
        testData.context,
        {
          id: transition.state?.jobId,
          job_type: 'UNPUBLISH',
          payload: {
            submission_version_id: dto.id,
            site_id: testData.siteId,
            user_id: testData.userId,
            cdn: 'https://test-cdn.com',
            key: uuidv7(),
          },
        },
        storageBackend as unknown as StorageBackend,
      );

      // Verify final state
      const final = await prisma.submissionVersion.findUnique({
        where: { id: dto.id },
        include: {
          job: true,
        },
      });
      expect(final).not.toBeNull();
      if (!final) return;

      expect(final.status).toEqual('UNPUBLISHED');
      expect(final.transition).toBeNull();

      const job = await prisma.job.findUnique({
        where: { id: transition.state?.jobId },
      });

      expect(job).not.toBeNull();
      if (!job) return;

      expect(job.status).toEqual('COMPLETED');
      expect(job.results).toBeDefined();
    });
  });
});
