// Type augmentation for React Router v7 AppLoadContext
// This ensures type safety for the context parameter in loaders and actions
declare module 'react-router' {
  // Since this codebase uses withContext wrappers that create their own Context class
  // and doesn't currently use args.context directly, this interface is defined as empty.
  // If you start using args.context in loaders/actions, add the context properties here.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AppLoadContext {
    // Add context properties here if needed in the future
    // Example:
    // db: Database;
    // logger: Logger;
  }

  // Augment LoaderFunctionArgs and ActionFunctionArgs to include context type
  // This provides type safety when accessing args.context in loaders/actions
  interface LoaderFunctionArgs {
    context: AppLoadContext;
  }

  interface ActionFunctionArgs {
    context: AppLoadContext;
  }
}

export {};
