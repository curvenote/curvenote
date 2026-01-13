// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect } from 'vitest';
import type { Workflow } from './types.js';

import {
  getWorkflowState,
  isPublished,
  isVisible,
  getAllTransitionsWithSourceState,
  getAllTransitionsWithTargetState,
  canTransitionTo,
  getValidTransition,
  requiresJob,
  getJobType,
  makeIsolatedState,
} from './utils.js';
import { KnownJobTypes } from '../backend/loaders/jobs/names.js';

const MOCK_WORKFLOW: Workflow = {
  version: 1,
  name: 'mock',
  label: 'Mock Workflow',
  initialState: 'A',
  states: {
    A: {
      ...makeIsolatedState('A'),
      visible: false,
      published: false,
    },
    B: {
      ...makeIsolatedState('B'),
      visible: false,
      published: false,
    },
    C: {
      ...makeIsolatedState('C'),
      visible: true,
      published: true,
    },
  },
  transitions: [
    {
      version: 1,
      name: 'transition1',
      sourceStateName: 'B',
      targetStateName: 'C',
      labels: {
        action: 'Transition 1',
        inProgress: 'Transitioning...',
        button: 'Transition 1',
        confirmation: 'Are you sure you want to transition to C?',
        success: 'Transition 1 successful',
      },
      userTriggered: true,
      help: 'Transition 1 help',
      requiredScopes: ['transition1'],
      requiresJob: true,
      options: {
        jobType: KnownJobTypes.PUBLISH,
        setsPublishedDate: true,
        updatesSlug: true,
      },
    },
    {
      version: 1,
      name: 'transition2',
      sourceStateName: 'C',
      targetStateName: 'A',
      labels: {
        action: 'Transition 2',
        inProgress: 'Transitioning...',
        button: 'Transition 2',
        confirmation: 'Are you sure you want to transition to A?',
        success: 'Transition 2 successful',
      },
      userTriggered: true,
      help: 'Transition 2 help',
      requiredScopes: ['transition2'],
      requiresJob: false,
    },
  ],
};

describe('Workflow Utils', () => {
  describe('getState', () => {
    it('should return state for valid status', () => {
      const state = getWorkflowState(MOCK_WORKFLOW, 'A');
      expect(state).toBeDefined();
      expect(state?.name).toBe('A');
    });

    it('should return undefined for invalid status', () => {
      const state = getWorkflowState(MOCK_WORKFLOW, 'invalid');
      expect(state).toBeUndefined();
    });
  });

  describe('isPublished', () => {
    it('should return true for published state', () => {
      expect(isPublished(MOCK_WORKFLOW, 'C')).toBe(true);
    });

    it('should return false for non-published state', () => {
      expect(isPublished(MOCK_WORKFLOW, 'A')).toBe(false);
    });
  });

  describe('isVisible', () => {
    it('should return true for visible state', () => {
      expect(isVisible(MOCK_WORKFLOW, 'C')).toBe(true);
    });

    it('should return false for non-visible state', () => {
      expect(isVisible(MOCK_WORKFLOW, 'A')).toBe(false);
    });
  });

  describe('getTransitionsFromState', () => {
    it('should return transitions from a state', () => {
      const transitions = getAllTransitionsWithSourceState(MOCK_WORKFLOW, 'B');
      expect(transitions).toHaveLength(1);
      expect(transitions[0].name).toBe('transition1');
    });

    it('should return empty array for state with no transitions', () => {
      const transitions = getAllTransitionsWithSourceState(MOCK_WORKFLOW, 'A');
      expect(transitions).toHaveLength(0);
    });
  });

  describe('getTransitionsToState', () => {
    it('should return transitions to a state', () => {
      const transitions = getAllTransitionsWithTargetState(MOCK_WORKFLOW, 'C');
      expect(transitions).toHaveLength(1);
      expect(transitions[0].name).toBe('transition1');
    });

    it('should return empty array for state with no incoming transitions', () => {
      const transitions = getAllTransitionsWithTargetState(MOCK_WORKFLOW, 'B');
      expect(transitions).toHaveLength(0);
    });
  });

  describe('canTransitionTo', () => {
    it('should return true for valid transition', () => {
      expect(canTransitionTo(MOCK_WORKFLOW, 'B', 'C')).toBe(true);
    });

    it('should return false for invalid transition', () => {
      expect(canTransitionTo(MOCK_WORKFLOW, 'A', 'C')).toBe(false);
    });
  });

  describe('getTransition', () => {
    it('should return transition for valid path', () => {
      const transition = getValidTransition(MOCK_WORKFLOW, 'B', 'C');
      expect(transition).toBeDefined();
      expect(transition?.name).toBe('transition1');
    });

    it('should return undefined for invalid path', () => {
      const transition = getValidTransition(MOCK_WORKFLOW, 'A', 'C');
      expect(transition).toBeUndefined();
    });
  });

  describe('requiresJob', () => {
    it('should return true for job-requiring transition', () => {
      const transition = getValidTransition(MOCK_WORKFLOW, 'B', 'C');
      expect(transition).toBeDefined();
      expect(requiresJob(transition!)).toBe(true);
    });

    it('should return false for non-job transition', () => {
      const transition = getValidTransition(MOCK_WORKFLOW, 'C', 'A');
      expect(transition).toBeDefined();
      expect(requiresJob(transition!)).toBe(false);
    });
  });

  describe('getJobType', () => {
    it('should return job type for job-requiring transition', () => {
      const transition = getValidTransition(MOCK_WORKFLOW, 'B', 'C');
      expect(transition).toBeDefined();
      expect(getJobType(transition!)).toBe(KnownJobTypes.PUBLISH);
    });

    it('should return undefined for non-job transition', () => {
      const transition = getValidTransition(MOCK_WORKFLOW, 'C', 'A');
      expect(transition).toBeDefined();
      expect(getJobType(transition!)).toBeUndefined();
    });
  });
});
