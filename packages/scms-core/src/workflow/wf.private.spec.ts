// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, test, expect } from 'vitest';
import { PRIVATE_SITE_WORKFLOW, STATE_NAMES } from './private.js';
import {
  canTransitionTo,
  getAllTransitionsWithSourceState,
  getAllTransitionsWithTargetState,
} from './utils.js';

describe('Private Site Workflow', () => {
  describe('structure', () => {
    test('should have all required states', () => {
      const states = Object.keys(PRIVATE_SITE_WORKFLOW.states);
      expect(states).toContain(STATE_NAMES.DRAFT);
      expect(states).toContain(STATE_NAMES.INCOMPLETE);
      expect(states).toContain(STATE_NAMES.PENDING);
      expect(states).toContain(STATE_NAMES.INCOMPLETE);
      expect(states).toContain(STATE_NAMES.REJECTED);
      expect(states).toContain(STATE_NAMES.PUBLISHED);
      expect(states).toContain(STATE_NAMES.UNPUBLISHED);
      expect(states).toContain(STATE_NAMES.RETRACTED);
    });

    test('should have correct state properties', () => {
      [
        STATE_NAMES.DRAFT,
        STATE_NAMES.PENDING,
        STATE_NAMES.INCOMPLETE,
        STATE_NAMES.REJECTED,
        STATE_NAMES.UNPUBLISHED,
        STATE_NAMES.RETRACTED,
      ].map((state) => PRIVATE_SITE_WORKFLOW.states[state].visible === false);

      [
        STATE_NAMES.DRAFT,
        STATE_NAMES.PENDING,
        STATE_NAMES.INCOMPLETE,
        STATE_NAMES.REJECTED,
        STATE_NAMES.UNPUBLISHED,
        STATE_NAMES.RETRACTED,
      ].map((state) => PRIVATE_SITE_WORKFLOW.states[state].published === false);

      [STATE_NAMES.PUBLISHED].map((state) => PRIVATE_SITE_WORKFLOW.states[state].visible === true);
      [STATE_NAMES.PUBLISHED].map(
        (state) => PRIVATE_SITE_WORKFLOW.states[state].published === true,
      );
    });

    test('should have valid transitions', () => {
      const validStateIds = Object.keys(PRIVATE_SITE_WORKFLOW.states);

      PRIVATE_SITE_WORKFLOW.transitions.forEach((transition) => {
        expect(validStateIds).toContain(transition.sourceStateName);
        expect(validStateIds).toContain(transition.targetStateName);
      });
    });
  });

  describe('traversals', () => {
    test('| => DRAFT => |', () => {
      expect(
        getAllTransitionsWithSourceState(PRIVATE_SITE_WORKFLOW, STATE_NAMES.DRAFT),
      ).toHaveLength(0);
      expect(
        getAllTransitionsWithTargetState(PRIVATE_SITE_WORKFLOW, STATE_NAMES.DRAFT),
      ).toHaveLength(0);
    });

    test('| => INCOMPLETE => |', () => {
      expect(
        getAllTransitionsWithSourceState(PRIVATE_SITE_WORKFLOW, STATE_NAMES.INCOMPLETE),
      ).toHaveLength(0);
      expect(
        getAllTransitionsWithTargetState(PRIVATE_SITE_WORKFLOW, STATE_NAMES.INCOMPLETE),
      ).toHaveLength(0);
    });

    test('PENDING => REJECTED', () => {
      expect(
        canTransitionTo(PRIVATE_SITE_WORKFLOW, STATE_NAMES.PENDING, STATE_NAMES.REJECTED),
      ).toBe(true);
    });

    test('REJECTED => PENDING', () => {
      expect(
        canTransitionTo(PRIVATE_SITE_WORKFLOW, STATE_NAMES.REJECTED, STATE_NAMES.PENDING),
      ).toBe(true);
    });

    test('PENDING => PUBLISHED', () => {
      expect(
        canTransitionTo(PRIVATE_SITE_WORKFLOW, STATE_NAMES.PENDING, STATE_NAMES.PUBLISHED),
      ).toBe(true);
    });

    test('PUBLISHED => UNPUBLISHED', () => {
      expect(
        canTransitionTo(PRIVATE_SITE_WORKFLOW, STATE_NAMES.PUBLISHED, STATE_NAMES.UNPUBLISHED),
      ).toBe(true);
    });

    test('PUBLISHED => RETRACTED', () => {
      expect(
        canTransitionTo(PRIVATE_SITE_WORKFLOW, STATE_NAMES.PUBLISHED, STATE_NAMES.RETRACTED),
      ).toBe(true);
    });

    test('UNPUBLISHED => PENDING', () => {
      expect(
        canTransitionTo(PRIVATE_SITE_WORKFLOW, STATE_NAMES.UNPUBLISHED, STATE_NAMES.PENDING),
      ).toBe(true);
    });

    test('should have correct transition counts', () => {
      // PENDING has transitions to REJECTED and PUBLISHED
      expect(
        getAllTransitionsWithSourceState(PRIVATE_SITE_WORKFLOW, STATE_NAMES.PENDING),
      ).toHaveLength(2);
      expect(
        getAllTransitionsWithTargetState(PRIVATE_SITE_WORKFLOW, STATE_NAMES.PENDING),
      ).toHaveLength(2);

      // REJECTED has one outgoing transition (to PENDING)
      expect(
        getAllTransitionsWithSourceState(PRIVATE_SITE_WORKFLOW, STATE_NAMES.REJECTED),
      ).toHaveLength(1);
      expect(
        getAllTransitionsWithTargetState(PRIVATE_SITE_WORKFLOW, STATE_NAMES.REJECTED),
      ).toHaveLength(1);

      // PUBLISHED has two outgoing transitions (to UNPUBLISHED and RETRACTED)
      expect(
        getAllTransitionsWithSourceState(PRIVATE_SITE_WORKFLOW, STATE_NAMES.PUBLISHED),
      ).toHaveLength(2);
      expect(
        getAllTransitionsWithTargetState(PRIVATE_SITE_WORKFLOW, STATE_NAMES.PUBLISHED),
      ).toHaveLength(1);

      // UNPUBLISHED has one outgoing transition (to PENDING)
      expect(
        getAllTransitionsWithSourceState(PRIVATE_SITE_WORKFLOW, STATE_NAMES.UNPUBLISHED),
      ).toHaveLength(1);
      expect(
        getAllTransitionsWithTargetState(PRIVATE_SITE_WORKFLOW, STATE_NAMES.UNPUBLISHED),
      ).toHaveLength(1);

      // RETRACTED has no outgoing transitions
      expect(
        getAllTransitionsWithSourceState(PRIVATE_SITE_WORKFLOW, STATE_NAMES.RETRACTED),
      ).toHaveLength(0);
      expect(
        getAllTransitionsWithTargetState(PRIVATE_SITE_WORKFLOW, STATE_NAMES.RETRACTED),
      ).toHaveLength(1);
    });
  });
});
