import { KnownJobTypes } from '../backend/loaders/jobs/names.js';
import { site } from '../scopes.js';
import type { Workflow } from './types.js';

export const STATE_NAMES = {
  DRAFT: 'DRAFT',
  INCOMPLETE: 'INCOMPLETE',
  PENDING: 'PENDING',
  REJECTED: 'REJECTED',
  IN_REVIEW: 'IN_REVIEW',
  PUBLISHED: 'PUBLISHED',
  UNPUBLISHED: 'UNPUBLISHED',
  RETRACTED: 'RETRACTED',
};

const MERMAID: string = `graph TD
    PENDING[PENDING<br/>Pending]
    REJECTED[REJECTED<br/>Rejected]
    IN_REVIEW[IN_REVIEW<br/>In Review]
    PUBLISHED[PUBLISHED<br/>Published]
    UNPUBLISHED[UNPUBLISHED<br/>Unpublished]
    RETRACTED[RETRACTED<br/>Retracted]

    PENDING -->|reject| REJECTED
    PENDING -->|start_review| IN_REVIEW
    REJECTED -->|reset| PENDING
    IN_REVIEW -->|publish| PUBLISHED
    PUBLISHED -->|unpublish| UNPUBLISHED
    UNPUBLISHED -->|reset_from_unpublished| PENDING

    %% Style end states
    classDef endState fill:#e5f5e5,stroke:#2d5a2d,stroke-width:2px

    class REJECTED,RETRACTED endState`;

export const CLOSED_REVIEW_WORKFLOW: Workflow = {
  version: 1,
  mermaid: MERMAID,
  name: 'CLOSED_REVIEW',
  label: 'Closed Review Workflow',
  initialState: STATE_NAMES.PENDING,
  states: {
    [STATE_NAMES.DRAFT]: {
      name: STATE_NAMES.DRAFT,
      label: 'Draft',
      visible: false,
      published: false,
      authorOnly: true,
      inbox: false,
      tags: ['ok'],
    },
    [STATE_NAMES.INCOMPLETE]: {
      name: STATE_NAMES.INCOMPLETE,
      label: 'Incomplete',
      visible: false,
      published: false,
      authorOnly: true,
      inbox: false,
      tags: ['ok'],
    },
    [STATE_NAMES.PENDING]: {
      name: STATE_NAMES.PENDING,
      label: 'Pending',
      visible: false,
      published: false,
      authorOnly: false,
      inbox: true,
      tags: ['ok'],
    },
    [STATE_NAMES.REJECTED]: {
      name: STATE_NAMES.REJECTED,
      label: 'Rejected',
      visible: false,
      published: false,
      authorOnly: false,
      inbox: false,
      tags: ['ok'],
    },
    [STATE_NAMES.IN_REVIEW]: {
      name: STATE_NAMES.IN_REVIEW,
      label: 'In Review',
      visible: false, // CLOSED REVIEW - not visible during review
      published: false,
      authorOnly: false,
      inbox: true,
      tags: ['ok'],
    },
    [STATE_NAMES.PUBLISHED]: {
      name: STATE_NAMES.PUBLISHED,
      label: 'Published',
      visible: true,
      published: true,
      authorOnly: false,
      inbox: false,
      tags: ['ok'],
    },
    [STATE_NAMES.UNPUBLISHED]: {
      name: STATE_NAMES.UNPUBLISHED,
      label: 'Unpublished',
      visible: false,
      published: false,
      authorOnly: false,
      inbox: false,
      tags: ['ok'],
    },
    [STATE_NAMES.RETRACTED]: {
      name: STATE_NAMES.RETRACTED,
      label: 'Retracted',
      visible: false,
      published: false,
      authorOnly: false,
      inbox: false,
      tags: ['ok'],
    },
  },
  transitions: [
    {
      version: 1,
      name: 'start_review',
      sourceStateName: STATE_NAMES.PENDING,
      targetStateName: STATE_NAMES.IN_REVIEW,
      labels: {
        action: 'Start Review',
        inProgress: 'Starting review...',
        button: 'Start Review',
        confirmation: 'Are you sure you want to start reviewing this submission?',
        success: 'Review started successfully',
      },
      userTriggered: true,
      help: 'Start reviewing the submission',
      requiredScopes: [site.submissions.update],
      requiresJob: false,
    },
    {
      version: 1,
      name: 'reject',
      sourceStateName: STATE_NAMES.PENDING,
      targetStateName: STATE_NAMES.REJECTED,
      labels: {
        action: 'Reject',
        inProgress: 'Rejecting...',
        button: 'Reject',
        confirmation: 'Are you sure you want to reject this submission?',
        success: 'Submission rejected successfully',
      },
      userTriggered: true,
      help: 'Reject the submission',
      requiredScopes: [site.submissions.update],
      requiresJob: false,
    },
    {
      version: 1,
      name: 'reset',
      sourceStateName: STATE_NAMES.REJECTED,
      targetStateName: STATE_NAMES.PENDING,
      labels: {
        action: 'Reset',
        inProgress: 'Resetting...',
        button: 'Reset',
        confirmation: 'Are you sure you want to reset this submission?',
        success: 'Submission reset successfully',
      },
      userTriggered: true,
      help: 'Reset the submission to pending',
      requiredScopes: [site.submissions.update],
      requiresJob: false,
    },
    {
      version: 1,
      name: 'publish',
      sourceStateName: STATE_NAMES.IN_REVIEW,
      targetStateName: STATE_NAMES.PUBLISHED,
      labels: {
        action: 'Publish',
        inProgress: 'Publishing...',
        button: 'Publish',
        confirmation: 'Are you sure you want to publish this submission?',
        success: 'Submission published successfully',
      },
      userTriggered: true,
      help: 'Publish the submission',
      requiredScopes: [site.submissions.update, site.publishing],
      requiresJob: true,
      options: {
        jobType: KnownJobTypes.PUBLISH,
        setsPublishedDate: true,
        updatesSlug: true,
      },
    },
    {
      version: 1,
      name: 'unpublish',
      sourceStateName: STATE_NAMES.PUBLISHED,
      targetStateName: STATE_NAMES.UNPUBLISHED,
      labels: {
        action: 'Unpublish',
        inProgress: 'Unpublishing...',
        button: 'Unpublish',
        confirmation: 'Are you sure you want to unpublish this submission?',
        success: 'Submission unpublished successfully',
      },
      userTriggered: true,
      help: 'Unpublish the submission',
      requiredScopes: [site.submissions.update, site.publishing],
      requiresJob: true,
      options: {
        jobType: KnownJobTypes.UNPUBLISH,
      },
    },
    {
      version: 1,
      name: 'reset_from_unpublished',
      sourceStateName: STATE_NAMES.UNPUBLISHED,
      targetStateName: STATE_NAMES.PENDING,
      labels: {
        action: 'Reset from Unpublished',
        inProgress: 'Resetting from unpublished...',
        button: 'Reset from Unpublished',
        confirmation: 'Are you sure you want to reset this submission from unpublished?',
        success: 'Submission reset successfully',
      },
      userTriggered: true,
      help: 'Reset the submission from unpublished to pending',
      requiredScopes: [site.submissions.update],
      requiresJob: false,
    },
    {
      version: 1,
      name: 'retract',
      sourceStateName: STATE_NAMES.PUBLISHED,
      targetStateName: STATE_NAMES.RETRACTED,
      labels: {
        action: 'Retract',
        inProgress: 'Retracting...',
        button: 'Retract',
        confirmation: 'Are you sure you want to retract this publicaton?',
        success: 'Submission retraction started',
      },
      userTriggered: true,
      requiresJob: true,
      requiredScopes: [site.submissions.update, site.publishing],
      help: 'Start retracting the submission',
      options: {
        jobType: KnownJobTypes.UNPUBLISH,
      },
    },
  ],
};
