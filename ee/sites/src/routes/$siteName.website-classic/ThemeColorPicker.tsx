import { useFetcher } from 'react-router';
import { useCallback, useRef, useState } from 'react';
import { ui } from '@curvenote/scms-core';
import { INTENTS } from './types.js';
import Color from 'color';

interface ThemeColorPickerProps {
  level: 'primary' | 'secondary';
  className?: string;
  initialValue?: string;
}

export function ThemeColorPicker({
  level,
  className,
  initialValue = '#3b82f6',
}: ThemeColorPickerProps) {
  const fetcher = useFetcher<{ error?: string }>();
  const [currentColor, setCurrentColor] = useState(initialValue);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleColorChange = useCallback(
    (value: Parameters<typeof Color.rgb>[0]) => {
      // Convert RGB array to hex color
      const hex = Color(value).hex();
      setCurrentColor(hex);

      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Set new timeout for form submission
      const timeout = setTimeout(() => {
        const formData = new FormData();
        formData.append('intent', INTENTS.updateColor);
        formData.append('color', hex);
        formData.append('level', level);

        fetcher.submit(formData, { method: 'post' });
      }, 500);

      debounceTimeoutRef.current = timeout;
    },
    [fetcher, level],
  );

  const isSubmitting = fetcher.state === 'submitting';

  return (
    <div className={className}>
      <ui.ColorPicker value={currentColor} onChange={handleColorChange}>
        <div className="relative">
          <ui.ColorPickerSelection className="h-48" />
          {/* Status messages in bottom right corner of selection area */}
          {isSubmitting && (
            <div className="absolute flex items-center gap-1 text-xs text-white bottom-2 right-2">
              <div className="w-3 h-3 border-2 border-white rounded-full border-t-transparent animate-spin" />
              <span>Saving...</span>
            </div>
          )}
          {fetcher.data?.error && !isSubmitting && (
            <div className="absolute px-2 py-1 text-xs text-red-600 rounded bottom-2 right-2 dark:text-red-400 bg-white/90 dark:bg-black/90">
              {fetcher.data.error}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <ui.ColorPickerEyeDropper />
          <div className="grid w-full gap-1">
            <ui.ColorPickerHue />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ui.ColorPickerOutput />
          <ui.ColorPickerFormat />
        </div>
      </ui.ColorPicker>
    </div>
  );
}
