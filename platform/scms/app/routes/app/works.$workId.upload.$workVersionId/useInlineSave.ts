import { useEffect, useRef, useState } from 'react';

type SaveState = 'idle' | 'saving' | 'saved';

interface UseInlineSaveOptions {
  /**
   * Current value that might need saving
   */
  value: string;
  /**
   * Initial/saved value to compare against
   */
  initialValue: string;
  /**
   * Function to call when saving should occur
   */
  onSave: () => void;
  /**
   * Whether saving is currently in progress (from fetcher or similar)
   */
  isSaving: boolean;
  /**
   * Minimum time in milliseconds to show "Saving..." indicator (default: 1000)
   */
  minSavingDisplayTime?: number;
  /**
   * Time in milliseconds to show the success checkmark (default: 1000)
   */
  successDisplayTime?: number;
}

interface UseInlineSaveReturn {
  /**
   * Handler to call on input blur - triggers immediate save
   */
  handleBlur: () => void;
  /**
   * Whether the value has changed from initial
   */
  hasChanges: boolean;
  /**
   * Current save state for UI display
   */
  saveState: SaveState;
}

/**
 * Custom hook for handling inline save with UI feedback
 * Handles blur saving and save state transitions
 *
 * @param options - Configuration options
 * @returns Handlers, state, and UI feedback for inline save functionality
 */
export function useInlineSave({
  value,
  initialValue,
  onSave,
  isSaving,
  minSavingDisplayTime = 1000,
  successDisplayTime = 1000,
}: UseInlineSaveOptions): UseInlineSaveReturn {
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const savingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveStartTimeRef = useRef<number | null>(null);

  const hasChanges = value !== initialValue;

  // Handle save state transitions based on isSaving prop
  useEffect(() => {
    if (isSaving) {
      setSaveState('saving');
      saveStartTimeRef.current = Date.now();
      // Clear any existing timeout
      if (savingTimeoutRef.current) {
        clearTimeout(savingTimeoutRef.current);
        savingTimeoutRef.current = null;
      }
    } else if (saveStartTimeRef.current !== null && saveState === 'saving') {
      // Transition from saving to saved
      const elapsed = Date.now() - saveStartTimeRef.current;
      const remainingTime = minSavingDisplayTime - elapsed;

      if (remainingTime > 0) {
        // Wait for the remaining time before showing tick
        savingTimeoutRef.current = setTimeout(() => {
          setSaveState('saved');
          saveStartTimeRef.current = Date.now();
        }, remainingTime);
      } else {
        // Already shown for minimum time, show tick immediately
        setSaveState('saved');
        saveStartTimeRef.current = Date.now();
      }
    }

    // Cleanup timeout on unmount
    return () => {
      if (savingTimeoutRef.current) {
        clearTimeout(savingTimeoutRef.current);
        savingTimeoutRef.current = null;
      }
    };
  }, [isSaving, saveState, minSavingDisplayTime]);

  // Handle hiding the checkmark after successDisplayTime
  useEffect(() => {
    if (saveState === 'saved' && saveStartTimeRef.current !== null) {
      // Clear any existing timeout
      if (savingTimeoutRef.current) {
        clearTimeout(savingTimeoutRef.current);
      }
      // Show tick for successDisplayTime
      savingTimeoutRef.current = setTimeout(() => {
        setSaveState('idle');
        saveStartTimeRef.current = null;
        savingTimeoutRef.current = null;
      }, successDisplayTime);
    }

    // Cleanup timeout on unmount
    return () => {
      if (savingTimeoutRef.current) {
        clearTimeout(savingTimeoutRef.current);
        savingTimeoutRef.current = null;
      }
    };
  }, [saveState, successDisplayTime]);

  const handleBlur = () => {
    // Only trigger save if value has changed
    if (hasChanges) {
      onSave();
    }
  };

  return {
    handleBlur,
    hasChanges,
    saveState,
  };
}
