import * as React from 'react';
import { Textarea } from './textarea.js';
import { CharacterCounter } from './character-counter.js';
import { cn } from '../../utils/cn.js';

export interface LimitedTextareaProps
  extends Omit<React.ComponentProps<'textarea'>, 'maxLength' | 'onChange'> {
  maxLength: number;
  value: string;
  onChange: (value: string) => void;
  showCounter?: boolean;
  counterClassName?: string;
}

/**
 * LimitedTextarea: A textarea with character limit enforcement and counter display
 *
 * Automatically enforces the character limit and displays a character counter.
 * The counter turns red when the limit is exceeded.
 */
export const LimitedTextarea = React.forwardRef<HTMLTextAreaElement, LimitedTextareaProps>(
  (
    { maxLength, value, onChange, showCounter = true, counterClassName, className, ...props },
    ref,
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      // Enforce max length
      if (newValue.length <= maxLength) {
        onChange(newValue);
      }
    };
    return (
      <div className="w-full min-w-0 space-y-1">
        <Textarea
          ref={ref}
          value={value}
          onChange={handleChange}
          maxLength={maxLength}
          className={cn(
            'w-full min-w-0 max-w-full break-words resize-none overflow-wrap-anywhere',
            className,
          )}
          style={{ fieldSizing: 'fixed' } as React.CSSProperties}
          {...props}
        />
        {showCounter && (
          <CharacterCounter current={value.length} max={maxLength} className={counterClassName} />
        )}
      </div>
    );
  },
);
LimitedTextarea.displayName = 'LimitedTextarea';
