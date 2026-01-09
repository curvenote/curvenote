# Custom Hooks for Workflow Transitions

This directory contains custom hooks for handling workflow transitions, optimistic updates, and job polling in the application.

## Hooks Overview

### `useOptimisticTransition`

Handles optimistic updates and transition state management for workflow transitions.

**Usage:**

```tsx
const {
  displayItem,
  activeTransition,
  setActiveTransition,
  applyOptimisticUpdate,
  handleTransitionSuccess,
  handleTransitionError,
  handleJobComplete,
  handleJobError,
} = useOptimisticTransition({
  initialItem: submissionItem,
  initialTransition: submissionItem.transition,
  onActivityUpdate: (activity) => {
    // Handle activity updates
  },
});
```

### `useJobPolling`

Handles job polling logic for job-based transitions, building on the existing `usePolling` hook.

**Usage:**

```tsx
const { isPolling, jobData, error } = useJobPolling({
  activeTransition,
  onJobComplete: (job, targetStateName) => {
    // Handle job completion
  },
  onJobError: (error) => {
    // Handle job errors
  },
});
```

### `useTransitionFetcher`

Handles the fetcher logic for workflow transitions, including error handling and response processing.

**Usage:**

```tsx
const { submitTransition, isTransitioning, hasError, error } = useTransitionFetcher({
  onTransitionSuccess: (transition) => {
    // Handle successful transition
  },
  onTransitionError: (error) => {
    // Handle transition error
  },
});

// Submit a transition
submitTransition(submissionVersionId, nextStatus, actionUrl);
```

## Example Integration

Here's how these hooks work together in a component:

```tsx
export function MyActionsArea({ item, onActivityUpdate }) {
  // Handle optimistic updates and transition state
  const {
    displayItem,
    activeTransition,
    setActiveTransition,
    applyOptimisticUpdate,
    handleTransitionSuccess,
    handleTransitionError,
    handleJobComplete,
    handleJobError,
  } = useOptimisticTransition({
    initialItem: item,
    initialTransition: item.transition,
    onActivityUpdate,
  });

  // Handle transition fetcher
  const { submitTransition, isTransitioning } = useTransitionFetcher({
    onTransitionSuccess: handleTransitionSuccess,
    onTransitionError: handleTransitionError,
  });

  // Handle job polling
  const { isPolling } = useJobPolling({
    activeTransition,
    onJobComplete: handleJobComplete,
    onJobError: handleJobError,
  });

  // Component logic...
}
```

## Benefits

1. **Separation of Concerns**: Each hook handles a specific aspect of the transition flow
2. **Reusability**: These hooks can be used across different components that handle workflow transitions
3. **Testability**: Each hook can be tested independently
4. **Maintainability**: Logic is centralized and easier to update
5. **Type Safety**: Full TypeScript support with proper typing

## Migration

When migrating existing components to use these hooks:

1. Replace manual state management with `useOptimisticTransition`
2. Replace manual fetcher logic with `useTransitionFetcher`
3. Replace manual polling logic with `useJobPolling`
4. Update the component to use the returned values from the hooks

This approach significantly reduces the complexity of components that handle workflow transitions while making the code more maintainable and reusable.
