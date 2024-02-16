import { combineReducers } from 'redux';
import { localReducer } from 'myst-cli';
import { apiReducer } from './api/reducers.js';
import { oxalink } from './oxa/reducers.js';

export const rootReducer = combineReducers({
  api: apiReducer,
  local: localReducer,
  oxalink: oxalink.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;
