import { useState, useCallback } from 'react';
import type { WorkflowTransition } from '@curvenote/scms-core';

interface UseOptimisticTransitionOptions<T> {
  initialItem: T;
  initialTransition?: WorkflowTransition | null;
  onActivityUpdate?: (activity: { date: string; by: { id: string; name: string } }) => void;
}

interface UseOptimisticTransitionReturn<T> {
  displayItem: T;
  optimisticItem: T | null;
  activeTransition: WorkflowTransition | null;
  setOptimisticItem: (item: T | null) => void;
  setActiveTransition: (transition: WorkflowTransition | null) => void;
  applyOptimisticUpdate: (updates: Partial<T>) => void;
  revertOptimisticUpdates: () => void;
  handleTransitionSuccess: (transition?: WorkflowTransition) => void;
  handleTransitionError: () => void;
  handleJobComplete: (job: any, targetStateName?: string) => void;
  handleJobError: (error: Error) => void;
}

export function useOptimisticTransition<T extends { status: string; transition?: any }>({
  initialItem,
  initialTransition,
  onActivityUpdate,
}: UseOptimisticTransitionOptions<T>): UseOptimisticTransitionReturn<T> {
  const [optimisticItem, setOptimisticItem] = useState<T | null>(null);
  const [activeTransition, setActiveTransition] = useState<WorkflowTransition | null>(
    initialTransition || null,
  );

  // Use optimistic item for display, fallback to original item
  const displayItem = optimisticItem || initialItem;

  const applyOptimisticUpdate = useCallback(
    (updates: Partial<T>) => {
      setOptimisticItem((prev) => ({
        ...(prev || initialItem),
        ...updates,
      }));
    },
    [initialItem],
  );

  const revertOptimisticUpdates = useCallback(() => {
    setOptimisticItem(null);
    setActiveTransition(null);
  }, []);

  const handleTransitionSuccess = useCallback(
    (transition?: WorkflowTransition) => {
      // Update active transition from response
      setActiveTransition(transition || null);

      // Update activity for immediate transitions
      if (!transition?.requiresJob) {
        onActivityUpdate?.({
          date: new Date().toISOString(),
          by: { id: 'current-user', name: 'Current User' }, // TODO: Get from context
        });
      }
    },
    [onActivityUpdate],
  );

  const handleTransitionError = useCallback(() => {
    // Revert optimistic updates on error
    revertOptimisticUpdates();
  }, [revertOptimisticUpdates]);

  const handleJobComplete = useCallback(
    (job: any, targetStateName?: string) => {
      if (job.status === 'COMPLETED') {
        // Job completed successfully - apply optimistic update to final status
        if (targetStateName) {
          setOptimisticItem({
            ...displayItem,
            status: targetStateName,
            transition: undefined,
          });
        }
        setActiveTransition(null);

        // Update activity for job-based transitions
        onActivityUpdate?.({
          date: new Date().toISOString(),
          by: { id: 'current-user', name: 'Current User' }, // TODO: Get from context
        });
      } else if (job.status === 'FAILED') {
        // Job failed - revert optimistic updates
        revertOptimisticUpdates();
      }
    },
    [displayItem, onActivityUpdate, revertOptimisticUpdates],
  );

  const handleJobError = useCallback(
    (error: Error) => {
      console.error(`Job polling error: ${error.message}`);
      revertOptimisticUpdates();
    },
    [revertOptimisticUpdates],
  );

  return {
    displayItem,
    optimisticItem,
    activeTransition,
    setOptimisticItem,
    setActiveTransition,
    applyOptimisticUpdate,
    revertOptimisticUpdates,
    handleTransitionSuccess,
    handleTransitionError,
    handleJobComplete,
    handleJobError,
  };
}
