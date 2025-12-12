import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

export const oxalink = createSlice({
  name: 'oxalink',
  initialState: { lookup: {} } as { lookup: Record<string, { path: string; url: string }> },
  reducers: {
    updateLinkInfo(
      state,
      action: PayloadAction<{
        path: string;
        oxa: string;
        url: string;
      }>,
    ) {
      const { oxa, path, url } = action.payload;
      state.lookup[oxa] = { path, url };
    },
  },
});

// Export the reducer directly for consistency with api/reducers.ts
export const oxalinkReducer = oxalink.reducer;

// Export the state type for better type safety
export type OxaState = ReturnType<typeof oxalinkReducer>;
