'use client';

import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { X } from 'lucide-react';

import { useControllableState } from '../../hooks/useControllableState.js';
import { Button } from './button.js';
import { Input } from './input.js';
import { cn } from '../../utils/cn.js';

const TAG_ID_PREFIX = 'tag';

type Primitive = string | number;

type Wrapper<T extends Primitive> = {
  value: T;
};

type ExtendedObject<T extends Primitive> = Wrapper<T> & {
  [key: string]: unknown;
};

type Tag<T extends Primitive> = T | Wrapper<T> | ExtendedObject<T>;

// Context Type
interface TagsInputContextType<T extends Tag<Primitive>> {
  tags: T[];
  addTags: (tag: Primitive | Primitive[]) => void;
  removeTag: (index: number) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  keyBindings: Record<React.KeyboardEvent['key'], TagsInputKeyActions>;
  isTagNonInteractive: boolean;
}

/**
 * Props for the TagsInput component.
 *
 * @template T - A generic type extending `Tag<Primitive>`, where `Primitive` is `string` or `number`.
 * @extends {Omit<React.HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue">}
 */
interface TagsInputProps<T extends Tag<Primitive>> extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue' | 'children'
> {
  /**
   * Array of tags representing the current value.
   * Each tag can be one of the following:
   * - A primitive (`string` or `number`).
   * - A wrapper object: `{ value: Primitive }`.
   * - An extended object: `{ value: Primitive, [key: Primitive]: unknown }`.
   *
   * @example
   * // Example with primitive tags:
   * value={["tag1", "tag2"]}
   *
   * @example
   * // Example with wrapper objects:
   * value={[{ value: "tag1" }, { value: "tag2" }]}
   *
   * @example
   * // Example with extended objects:
   * value={[
   *   { value: "tag1", label: "Tag 1", color: "red" },
   *   { value: "tag2", description: "Second tag" }
   * ]}
   */
  value?: T[];

  /**
   * Default array of tags to initialize the component with.
   * Each tag can be one of the following:
   * - A primitive (`string` or `number`).
   * - A wrapper object: `{ value: Primitive }`.
   * - An extended object: `{ value: Primitive, [key: Primitive]: unknown }`.
   */
  defaultValue?: T[];

  /**
   * Callback invoked when the tags array is updated.
   * Accepts a new array of tags.
   *
   * @param updatedTags - The updated tags array.
   * @example
   * // Example with direct update:
   * onChange={(updatedTags) => console.log(updatedTags)}
   */
  onChange?: (updatedTags: T[]) => void;

  /**
   * Function to parse input into a tag object.
   * Required if the `value` consists of objects rather than primitives.
   *
   * @param input - The input value to be parsed (either `string` or `number`).
   * @returns {ExtendedObject<Primitive>} A parsed tag object.
   * @example
   * parseInput={(input) => ({ value: input, label: `Tag: ${input}` })}
   */
  parseInput?: (input: Primitive) => ExtendedObject<Primitive>;

  /**
   * Custom renderable children or a function component.
   */
  children?: React.ReactNode | ((props: { tags: T[] }) => React.ReactNode);

  /**
   * Layout direction for displaying tags.
   * Can be "row" for horizontal or "column" for vertical layout.
   *
   * @default "column"
   */
  orientation?: 'row' | 'column';

  /**
   * Whether the tags are displayed inline or not.
   *
   * @default false
   */
  inline?: boolean;

  /**
   * Maximum number of tags allowed.
   * Prevents adding more tags if this limit is reached.
   *
   * @example
   * maxTags={10}
   */
  maxTags?: number;

  /**
   * Minimum number of tags required.
   * Ensures at least this many tags are present.
   *
   * @example
   * minTags={1}
   */
  minTags?: number;

  /**
   * Whether duplicate tags are allowed.
   * Duplicates are determined based on the tag's value.
   *
   * @default false
   * @example
   * allowDuplicates={true}
   */
  allowDuplicates?: boolean;

  /**
   * Whether duplicate checks are case-sensitive.
   *
   * - `true` -> Case-sensitive duplicate checks (e.g., "Tag" and "tag" are different).
   * - `false` -> Case-insensitive duplicate checks (e.g., "Tag" and "tag" are the same).
   *
   * @default false
   */
  caseSensitiveDuplicates?: boolean;

  /**
   * Disable the entire component.
   * Prevents interaction with the tags.
   *
   * @default false
   */
  disabled?: boolean;

  /**
   * Prevents adding or removing tags, making the component read-only.
   *
   * @default false
   */
  readOnly?: boolean;

  /**
   * Mapping of keyboard commands to tag actions.
   * Allows customization of the key bindings for actions like adding or removing tags.
   *
   * @default defaultKeyBindings
   * @example
   * keyboardCommands={{
   *   Enter: TagsInputKeyActions.Add,
   *   Backspace: TagsInputKeyActions.Remove,
   *   ArrowLeft: TagsInputKeyActions.NavigateLeft,
   *   ArrowRight: TagsInputKeyActions.NavigateRight
   * }}
   */
  keyboardCommands?: Record<React.KeyboardEvent['key'], TagsInputKeyActions>;
}

interface TagsInputItemProps
  extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof tagsInputItemVariants> {
  asChild?: boolean;
  disabled?: boolean;
}

export enum Delimiters {
  Comma = ',',
  Semicolon = ';',
  Space = ' ',
}

const DelimiterPatterns: Record<Delimiters, RegExp> = {
  [Delimiters.Comma]: /,\s*/,
  [Delimiters.Semicolon]: /;\s*/,
  [Delimiters.Space]: /\s+/,
};

export enum TagsInputKeyActions {
  Add = 'add',
  Remove = 'remove',
  NavigateLeft = 'navigateLeft',
  NavigateRight = 'navigateRight',
}

const defaultKeyBindings: Record<React.KeyboardEvent['key'], TagsInputKeyActions> = {
  Enter: TagsInputKeyActions.Add,
  Delete: TagsInputKeyActions.Remove,
  Backspace: TagsInputKeyActions.Remove,
  ArrowLeft: TagsInputKeyActions.NavigateLeft,
  ArrowRight: TagsInputKeyActions.NavigateRight,
};

const TagsInputContext = React.createContext<TagsInputContextType<Tag<Primitive>> | null>(null);

const useTagsInput = (): TagsInputContextType<Tag<Primitive>> => {
  const context = React.useContext(TagsInputContext);

  if (!context) {
    throw new Error('The `useTagsInput` hook must be used within a `TagsInputProvider`.');
  }

  return context;
};

function forwardRefWithGenerics<T, P = object>(
  render: (props: P, ref: React.Ref<T>) => React.ReactNode,
): (props: P & React.RefAttributes<T>) => React.ReactNode {
  return React.forwardRef(render as any) as any;
}

function mergeRefs<T>(
  ...refs: Array<React.MutableRefObject<T> | React.LegacyRef<T>>
): React.RefCallback<T> {
  return (value) => {
    refs.forEach((ref) => {
      if (typeof ref === 'function') {
        ref(value);
      } else if (ref != null) {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    });
  };
}

function isObject<T extends Primitive>(value: Tag<T>): value is ExtendedObject<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'value' in value &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

const TagsInput = forwardRefWithGenerics(
  <T extends Tag<Primitive>>(
    {
      value,
      defaultValue,
      onChange,
      className,
      children,
      orientation = 'column',
      inline = false,
      maxTags,
      minTags,
      allowDuplicates = false,
      caseSensitiveDuplicates = false,
      disabled = false,
      readOnly = false,
      keyboardCommands = defaultKeyBindings,
      parseInput,
      ...rest
    }: TagsInputProps<T>,
    ref: React.Ref<HTMLDivElement>,
  ) => {
    const [_tags, _setTags] = useControllableState({
      prop: value,
      defaultProp: defaultValue,
      onChange,
    });

    const inputRef = React.useRef<HTMLInputElement>(null);

    const isTagNonInteractive = disabled || readOnly;

    const tags = _tags ?? [];

    const keyBindings = React.useMemo(() => {
      return { ...defaultKeyBindings, ...keyboardCommands };
    }, [defaultKeyBindings, keyboardCommands]);

    const setTags = React.useCallback(
      (updatedTags: T[] | ((prevTags: T[]) => T[])) => {
        const resolveTags = (prevTags: T[]): T[] => {
          return typeof updatedTags === 'function' ? updatedTags(prevTags) : updatedTags;
        };

        _setTags((prevTags) => {
          return resolveTags(prevTags ?? []);
        });
      },
      [_setTags],
    );

    // Helper function to normalize tag values for comparison
    const normalizeTag = (tag: T, caseSensitive: boolean): string => {
      if (isObject(tag)) {
        return caseSensitive ? String(tag.value) : String(tag.value).toLowerCase();
      }
      return caseSensitive ? String(tag) : String(tag).toLowerCase();
    };

    // Checks for duplicates based on the unique normalized tag and normalized existing tag
    const isDuplicate = React.useCallback(
      (
        normalizedTag: Primitive,
        uniqueNormalizedTags: Set<Primitive>,
        normalizedExistingTags: Set<Primitive>,
      ): boolean => {
        return uniqueNormalizedTags.has(normalizedTag) || normalizedExistingTags.has(normalizedTag);
      },
      [],
    );

    const memoizedParseInput = React.useMemo(() => parseInput, []);

    const addTags = React.useCallback(
      (tag: Primitive | Primitive[]) => {
        if (isTagNonInteractive || tag == null) return;

        // Pre-check for the maxTags condition
        if (maxTags && tags.length >= maxTags) return;

        // Pre-check for the minTags condition
        if (minTags && tags.length < minTags) return;

        const arrayTags = Array.isArray(tag) ? tag : [tag];

        const normalizedExistingTags = new Set(
          tags.map((t) => normalizeTag(t, caseSensitiveDuplicates)),
        );

        const uniqueNormalizedTags = new Set<Primitive>();
        const tagsToAdd: T[] = [];

        for (const singleTag of arrayTags) {
          // Preprocess the tag if a parseInput function is provided
          const parsedTag = memoizedParseInput ? memoizedParseInput(singleTag) : singleTag;

          const normalizedTag = normalizeTag(parsedTag as T, caseSensitiveDuplicates);

          // Check if we can add more tags without exceeding maxTags
          if (maxTags && tags.length + tagsToAdd.length >= maxTags) {
            break;
          }

          // Handle duplicates
          if (allowDuplicates) {
            tagsToAdd.push(parsedTag as T);
          } else {
            if (!isDuplicate(normalizedTag, uniqueNormalizedTags, normalizedExistingTags)) {
              uniqueNormalizedTags.add(normalizedTag);
              tagsToAdd.push(parsedTag as T);
            }
          }
        }

        // Final validation for minTags AFTER adding
        if (minTags && tags.length + tagsToAdd.length < minTags) {
          return;
        }

        if (tagsToAdd.length > 0) {
          setTags((prevTags) => [...prevTags, ...tagsToAdd]);
        }
      },
      [
        tags,
        maxTags,
        minTags,
        allowDuplicates,
        isDuplicate,
        isTagNonInteractive,
        memoizedParseInput,
        caseSensitiveDuplicates,
        normalizeTag,
        setTags,
      ],
    );

    const removeTag = React.useCallback(
      (index: number) => {
        if (isTagNonInteractive) return;

        // Guard to ensure the index is valid
        if (index < 0 || index >= tags.length || !Number.isInteger(index)) {
          return;
        }

        const updatedTags = [...tags];
        updatedTags.splice(index, 1);
        setTags(updatedTags);

        inputRef.current?.focus();
      },
      [isTagNonInteractive, tags],
    );

    const contextValue = React.useMemo<TagsInputContextType<T>>(
      () => ({
        tags,
        addTags,
        removeTag,
        inputRef,
        keyBindings,
        isTagNonInteractive,
      }),
      [tags, addTags, removeTag, isTagNonInteractive, keyBindings],
    );

    return (
      <div
        ref={ref}
        data-orientation={orientation}
        data-inline={inline ? '' : undefined}
        data-disabled={isTagNonInteractive ? '' : undefined}
        className={cn(
          'group flex flex-col space-y-2 data-[inline]:mx-auto data-[inline]:max-w-[450px] data-[inline]:rounded-md data-[inline]:border data-[inline]:border-secondary data-[inline]:px-3 data-[inline]:py-2.5',
          className,
        )}
        {...rest}
      >
        <TagsInputContext.Provider value={contextValue}>
          {typeof children === 'function' ? children({ tags: contextValue.tags }) : children}
        </TagsInputContext.Provider>
      </div>
    );
  },
);

// TagsInput.displayName = "TagsInput"

const TagsInputGroupContext = React.createContext<{
  keyIndex: number;
  textIdPrefix: string;
  groupRef: React.RefObject<HTMLDivElement>;
} | null>(null);

const useTagsInputGroup = () => {
  const context = React.useContext(TagsInputGroupContext);

  if (!context) {
    throw new Error('The `useTagsInputGroup` hook must be used within a `TagsInputGroupProvider`');
  }

  return context;
};

const TagsInputGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...rest }, forwardedRef) => {
    const textId = React.useId();
    const groupRef = React.useRef<HTMLDivElement>(null);

    return (
      <div
        ref={mergeRefs(groupRef, forwardedRef)}
        className={cn(
          'flex w-full flex-wrap items-center gap-x-2 gap-y-1 group-data-[orientation=column]:flex-row group-data-[orientation=row]:flex-col',
          className,
        )}
        {...rest}
      >
        {React.Children.map(children, (child, index) => {
          if (React.isValidElement(child)) {
            return (
              <TagsInputGroupContext.Provider
                value={{
                  keyIndex: index,
                  textIdPrefix: `${textId}-tag-${index}`,
                  groupRef,
                }}
              >
                {child}
              </TagsInputGroupContext.Provider>
            );
          }
          return child;
        })}
      </div>
    );
  },
);

TagsInputGroup.displayName = 'TagsInputGroup';

const tagsInputItemVariants = cva(
  'inline-flex shrink-0 items-center justify-between text-primary-foreground transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 group-data-[orientation=row]:w-full data-[disabled]:[&_svg]:pointer-events-none data-[disabled]:[&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary hover:bg-primary/90',
        outline:
          'border border-input bg-background text-accent-foreground hover:bg-accent hover:text-accent-foreground/80',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'text-accent-foreground hover:bg-accent hover:text-accent-foreground/80',
      },
      shape: {
        default: 'rounded-md',
        rounded: 'rounded-full',
        square: 'rounded-none',
        pill: 'rounded-lg',
      },
      size: {
        default: 'h-8 px-2 text-sm',
        sm: 'h-7 px-2 text-sm',
        lg: 'h-10 px-4 text-xl',
      },
    },
    defaultVariants: {
      shape: 'default',
      variant: 'default',
      size: 'default',
    },
  },
);

const TagsInputItem = React.forwardRef<HTMLElement, TagsInputItemProps>(
  (
    { className, asChild = false, variant, size, shape, onKeyDown, disabled = false, ...rest },
    forwardedRef,
  ) => {
    const { removeTag, inputRef, isTagNonInteractive, keyBindings } = useTagsInput();

    const { keyIndex, textIdPrefix } = useTagsInputGroup();

    const Comp = asChild ? Slot : 'div';

    const itemRef = React.useRef<HTMLElement | null>(null);

    const focusInput = React.useCallback(() => {
      if (!inputRef.current) return;
      inputRef.current.focus();
    }, []);

    const isFocused = React.useCallback(() => document.activeElement === itemRef.current, []);

    const isTagDisabled = isTagNonInteractive || disabled;

    const handleTagKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLElement>) => {
        if (onKeyDown) {
          onKeyDown(e);

          if (e.defaultPrevented) {
            return;
          }
        }

        if (isTagDisabled) return;

        const action = keyBindings[e.key];
        if (!action) return;

        const findFocusableSibling = (
          current: HTMLElement | null,
          direction: 'previous' | 'next',
        ): HTMLElement | null => {
          let sibling =
            direction === 'previous'
              ? current?.previousElementSibling
              : current?.nextElementSibling;

          while (sibling) {
            const siblingDisabled = sibling.getAttribute('data-disabled') === 'true';

            if (!siblingDisabled) {
              return sibling as HTMLElement; // Found a focusable sibling
            }

            sibling =
              direction === 'previous'
                ? sibling.previousElementSibling
                : sibling.nextElementSibling;
          }

          return null; // No valid sibling found
        };

        switch (action) {
          case TagsInputKeyActions.Remove:
            if (isFocused()) {
              e.preventDefault();
              removeTag(keyIndex); // Removes the current tag
            }
            break;

          case TagsInputKeyActions.NavigateLeft: {
            e.preventDefault();
            const prevSibling = findFocusableSibling(itemRef.current, 'previous');
            if (prevSibling) {
              prevSibling.focus(); // Focus the previous non-disabled tag
            }
            break;
          }

          case TagsInputKeyActions.NavigateRight: {
            e.preventDefault();
            const nextSibling = findFocusableSibling(itemRef.current, 'next');
            if (nextSibling) {
              nextSibling.focus(); // Focus the next non-disabled tag
            } else {
              focusInput(); // Focuses the input field if no more siblings
            }
            break;
          }

          default:
            break;
        }
      },
      [onKeyDown, removeTag, focusInput, isFocused, isTagDisabled, keyBindings, keyIndex],
    );

    return (
      <Comp
        ref={mergeRefs(forwardedRef, itemRef)}
        data-id={`${TAG_ID_PREFIX}-${keyIndex}`}
        data-disabled={isTagDisabled ? '' : undefined}
        tabIndex={isTagDisabled ? -1 : 0}
        aria-labelledby={textIdPrefix}
        aria-disabled={isTagDisabled}
        onKeyDown={handleTagKeyDown}
        className={cn(tagsInputItemVariants({ variant, size, shape }), className)}
        {...rest}
      />
    );
  },
);

TagsInputItem.displayName = 'TagsInputItem';

const TagsInputItemText = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...rest }, ref) => {
    const { textIdPrefix } = useTagsInputGroup();
    return <span id={textIdPrefix} aria-hidden className={cn('', className)} ref={ref} {...rest} />;
  },
);

TagsInputItemText.displayName = 'TagsInputItemText';

const TagsInputItemDelete = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, disabled, ...rest }, ref) => {
  const { removeTag, isTagNonInteractive } = useTagsInput();

  const isButtonNonInteractive = disabled || isTagNonInteractive;

  const { keyIndex } = useTagsInputGroup();

  const handleRemove = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      removeTag(keyIndex);
    },
    [removeTag, keyIndex],
  );

  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      aria-label="delete tag"
      aria-disabled={isButtonNonInteractive}
      size="icon"
      className={cn('ml-2 h-5 w-5', className)}
      onClick={handleRemove}
      disabled={isButtonNonInteractive}
      {...rest}
    >
      <X aria-hidden />
    </Button>
  );
});

TagsInputItemDelete.displayName = 'TagsInputItemDelete';

const TagsInputInput = React.forwardRef<
  React.ElementRef<typeof Input>,
  React.ComponentProps<typeof Input> & { delimiters?: Delimiters[] }
>(
  (
    {
      className,
      onPaste,
      onKeyDown,
      disabled = false,
      readOnly = false,
      delimiters = [Delimiters.Comma],
      ...rest
    },
    forwardedRef,
  ) => {
    const { addTags, inputRef: inputContextRef, keyBindings, isTagNonInteractive } = useTagsInput();
    const { groupRef } = useTagsInputGroup();

    const isInputNonInteractive = disabled || readOnly || isTagNonInteractive;

    const inputRef = React.useRef<HTMLInputElement>(null);

    const useDelimiterRegex = (delims: Delimiters[]): RegExp => {
      return React.useMemo(() => {
        const patterns = delims.map((delim) => DelimiterPatterns[delim]);
        return new RegExp(patterns.map((regex) => regex.source).join('|'), 'g');
      }, [delims]);
    };

    const delimiterRegex = useDelimiterRegex(delimiters);

    const processInputValue = React.useCallback(
      (value: string) => {
        const trimmedValue = value.trim();
        if (!trimmedValue) return;

        const parseTag = (tag: string) => (!isNaN(Number(tag)) ? Number(tag) : tag.trim());

        const tags =
          delimiters.length && delimiterRegex.test(trimmedValue)
            ? trimmedValue.split(delimiterRegex).map(parseTag).filter(Boolean)
            : [parseTag(trimmedValue)];

        addTags(tags);
      },
      [delimiterRegex, addTags, delimiters],
    );

    const handleInputKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (onKeyDown) {
          onKeyDown(e);

          if (e.defaultPrevented) {
            return;
          }
        }

        if (isInputNonInteractive || !inputRef.current) return;

        const command = keyBindings[e.key];
        if (command === TagsInputKeyActions.Remove) {
          if (inputRef.current.value === '') {
            if (!groupRef.current) return;

            const tags = groupRef.current?.querySelectorAll(
              '[data-id]:not([data-disabled="true"])',
            );

            const lastNonDisabledTag = Array.from(tags || []).pop();
            if (lastNonDisabledTag) {
              return (lastNonDisabledTag as HTMLElement).focus(); // Focus the last non-disabled tag
            }
          }
        } else if (command === TagsInputKeyActions.Add) {
          e.preventDefault();
          processInputValue(inputRef.current.value);
          inputRef.current.value = '';
        }
      },
      [keyBindings, isInputNonInteractive, processInputValue],
    );

    const handleInputPaste = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        if (onPaste) {
          onPaste(e);

          if (e.defaultPrevented) {
            return;
          }
        }

        if (isInputNonInteractive) return;

        const pasteData = e.clipboardData.getData('text');

        processInputValue(pasteData);
        e.preventDefault();
      },
      [addTags, isInputNonInteractive, processInputValue],
    );

    return (
      <Input
        ref={mergeRefs(forwardedRef, inputRef, inputContextRef)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        aria-disabled={isInputNonInteractive}
        disabled={isInputNonInteractive}
        onKeyDown={handleInputKeyDown}
        onPaste={handleInputPaste}
        className={cn('grow [[data-inline][data-orientation=column]_&]:basis-2/4', className)}
        {...rest}
      />
    );
  },
);

TagsInputInput.displayName = 'TagsInputInput';

export {
  TagsInput,
  TagsInputGroup,
  TagsInputItem,
  TagsInputItemText,
  TagsInputItemDelete,
  TagsInputInput,
};
