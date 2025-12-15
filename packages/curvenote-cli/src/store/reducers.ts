import type { Reducer } from 'redux';
import { combineReducers } from 'redux';
import { localReducer } from 'myst-cli';
import { apiReducer } from './api/reducers.js';
import type { APIState } from './api/reducers.js';
import { oxalinkReducer } from './oxa/reducers.js';
import type { OxaState } from './oxa/reducers.js';

// Import the LocalState type from myst-cli for better type safety
type LocalState = ReturnType<typeof localReducer>;

// Define the root state interface explicitly
export interface RootState {
  api: APIState;
  local: LocalState;
  oxalink: OxaState;
}

// Type the rootReducer explicitly to avoid TypeScript inference issues
export const rootReducer: Reducer<RootState> = combineReducers({
  api: apiReducer,
  local: localReducer,
  oxalink: oxalinkReducer,
});
