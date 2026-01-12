import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Custom hook to automatically trigger upload flow when `triggerUpload=true` query parameter is present.
 * Removes the parameter from the URL after triggering.
 *
 * @param canUpload - Whether the user has permission to upload (may be undefined)
 * @param onTrigger - Callback function to execute when upload should be triggered
 */
export function useTriggerUpload(canUpload: boolean | undefined, onTrigger: () => void) {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const triggerUpload = searchParams.get('triggerUpload');
    if (triggerUpload === 'true' && canUpload) {
      // Remove the triggerUpload parameter from URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('triggerUpload');
      setSearchParams(newParams, { replace: true });
      // Trigger the upload flow
      onTrigger();
    }
  }, [searchParams, canUpload, onTrigger, setSearchParams]);
}
