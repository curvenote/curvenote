import { Card } from '../primitives/index.js';
import { cn } from '../../utils/cn.js';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group.js';

/**
 * Generic question option interface - supports various question types
 */
export interface QuestionOption {
  value: string | boolean;
  label: string | React.ReactNode;
  subLabel?: string;
  icon?: string;
  iconAlt?: string;
}

/**
 * Generic question configuration interface
 */
export interface WizardQuestion {
  id: string;
  title: string;
  description?: string | React.ReactNode[];
  type: 'boolean' | 'radio' | 'vertical' | 'radio_vertical';
  wide?: boolean;
  conditional?: string;
  options: QuestionOption[];
}

/**
 * Special renderer function for complex option displays
 */
export type SpecialRenderer = (option: QuestionOption, isSelected: boolean) => React.ReactNode;

interface WizardQuestionProps<T = string | boolean> {
  question: WizardQuestion;
  value: T | null;
  onChange: (value: T) => void;
  buttonClassName?: string;
  containerClassName?: string;
  disabled?: boolean;
  iconMap?: Record<string, string>;
  specialRenderers?: Record<string, SpecialRenderer>;
}

/**
 * Generic WizardQuestion: Reusable question component for form wizards
 *
 * Supports different question types (boolean, radio, vertical) with configurable
 * icon rendering and special option displays. Designed to be domain-agnostic
 * while supporting complex use cases through the plugin system.
 *
 * @param question - Question configuration
 * @param value - Current answer value
 * @param onChange - Callback when answer changes
 * @param iconMap - Maps icon names to imported asset URLs
 * @param specialRenderers - Custom renderers for complex options (e.g. multi-icon displays)
 * @param className - Optional CSS classes
 * @param disabled - Whether the question is disabled
 */
export function WizardQuestion<T = string | boolean>({
  question,
  value,
  onChange,
  buttonClassName,
  containerClassName,
  disabled = false,
  iconMap = {},
  specialRenderers = {},
}: WizardQuestionProps<T>) {
  // Use provided textRenderer or fall back to default
  const renderOption = (option: QuestionOption) => {
    const isSelected = value === option.value;
    let label: React.ReactNode = option.label;

    // Handle options with subLabel (like uncertainty options)
    if (option.subLabel) {
      label = (
        <div className="flex flex-col items-center text-center">
          <div className="text-lg font-medium">{option.label}</div>
          <div className="text-sm leading-tight opacity-70">{option.subLabel}</div>
        </div>
      );
    } else if (typeof option.label === 'string' && option.label.includes('(')) {
      // Handle existing parentheses pattern for string labels only
      const [first, rest] = option.label.split('(').map((s) => s.trim());
      label = (
        <div className="flex flex-col items-center">
          <div>{first}</div>
          <div className="text-sm whitespace-nowrap opacity-70">({rest}</div>
        </div>
      );
    }

    return (
      <label
        key={option.value.toString()}
        className={cn(
          'relative w-full sm:w-[174px]',
          {
            // Vertical questions need more width for content
            'sm:w-[522px]': question.type === 'vertical' || question.type === 'radio_vertical',
            // Wide option for complex content or "I'm not sure" options
            'sm:w-[226px]':
              (question.wide || option.subLabel) &&
              question.type !== 'vertical' &&
              question.type !== 'radio_vertical',
            'sm:w-[679px]':
              (question.wide || option.subLabel) &&
              (question.type === 'vertical' || question.type === 'radio_vertical'),
            // Ensure equal heights for boolean and horizontal questions
            flex:
              question.type === 'boolean' ||
              (question.type !== 'vertical' && question.type !== 'radio_vertical'),
          },
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        <RadioGroupItem
          value={option.value.toString()}
          id={`${question.id}-${option.value}`}
          className="sr-only peer"
          disabled={disabled}
        />
        {/* Custom radio indicator: border and dot both absolutely positioned */}
        <span
          className={cn(
            'absolute top-2 right-2 z-10 block w-5 h-5 rounded-full border-2 border-blue-200 bg-white',
            'transition-colors',
            'peer-data-[state=checked]:border-blue-500',
            disabled ? 'cursor-not-allowed' : 'cursor-pointer',
          )}
        />
        <span
          className={cn(
            'absolute top-[12px] right-[12px] z-10 w-3 h-3 rounded-full bg-blue-500 transition-opacity',
            'opacity-0 peer-data-[state=checked]:opacity-100',
            disabled ? 'cursor-not-allowed' : 'cursor-pointer',
          )}
        />
        <Card
          lift={!disabled}
          className={cn(
            'relative flex flex-col sm:items-center justify-center',
            // Use reduced horizontal padding for uncertainty options with subLabel
            option.subLabel ? 'px-4 py-4' : 'p-4',
            // Ensure consistent height for boolean and horizontal radio questions
            question.type === 'boolean' ||
              (question.type !== 'vertical' && question.type !== 'radio_vertical')
              ? 'h-full'
              : '',
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
            'border border-stone-200 dark:border-stone-500',
            !disabled && 'hover:border-stone-400 dark:hover:border-stone-400',
            'peer-data-[state=checked]:border-blue-400 peer-data-[state=checked]:bg-blue-50',
            !disabled &&
              'hover:peer-data-[state=checked]:border-blue-400 hover:peer-data-[state=checked]:bg-blue-50',
            'dark:peer-data-[state=checked]:border-blue-600 dark:peer-data-[state=checked]:bg-blue-800',
            !disabled &&
              'dark:hover:peer-data-[state=checked]:border-blue-600 dark:hover:peer-data-[state=checked]:bg-blue-800',
            'transition-all duration-100',
            !disabled &&
              'peer-focus:outline-primary peer-focus:outline-2 peer-focus:outline-offset-2',
            buttonClassName,
            'bg-white dark:bg-stone-900',
          )}
        >
          <div
            className={cn(
              'flex flex-col gap-5 justify-center items-center px-6 sm:flex-col sm:gap-0 grow',
              {
                'min-h-[120px]':
                  question.type !== 'vertical' &&
                  question.type !== 'radio_vertical' &&
                  question.type !== 'boolean',
              },
            )}
          >
            {/* Check for special renderer first */}
            {option.icon && specialRenderers[option.icon]
              ? specialRenderers[option.icon](option, isSelected)
              : /* Regular single icon rendering using iconMap */
                option.icon &&
                iconMap[option.icon] && (
                  <div className="flex flex-col items-center justify-center grow">
                    <img
                      src={iconMap[option.icon]}
                      alt={
                        option.iconAlt ||
                        (typeof option.label === 'string' ? option.label : 'Option icon')
                      }
                      className="w-12 h-12"
                    />
                  </div>
                )}
            <div
              className={cn('w-full text-center text-md gap-[2px] sm:w-fit', {
                'font-semibold text-blue-600 dark:text-blue-400': isSelected,
              })}
            >
              {label}
            </div>
          </div>
        </Card>
      </label>
    );
  };

  if (question.type === 'boolean') {
    return (
      <div className={cn('space-y-4', containerClassName)}>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">{question.title}</h2>
          {question.description && (
            <span className="mb-2 text-muted-foreground">{question.description}</span>
          )}
        </div>
        <RadioGroup
          value={value?.toString() || ''}
          onValueChange={(val) => onChange((val === 'true') as T)}
          className="flex flex-col gap-2 p-1 sm:gap-4 sm:flex-row sm:items-stretch"
          disabled={disabled}
        >
          {question.options.map(renderOption)}
        </RadioGroup>
      </div>
    );
  }

  if (question.type === 'vertical' || question.type === 'radio_vertical') {
    return (
      <div className={cn('space-y-4', containerClassName)}>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">{question.title}</h2>
          {question.description && (
            <span className="text-muted-foreground">{question.description}</span>
          )}
        </div>
        <RadioGroup
          value={value?.toString() || ''}
          onValueChange={(val) => onChange(val as T)}
          className="grid-cols-1 gap-2 p-1 w-full max-w-[522px]"
          orientation="vertical"
          disabled={disabled}
        >
          {question.options.map(renderOption)}
        </RadioGroup>
      </div>
    );
  }

  // Default radio (horizontal)
  return (
    <div className={cn('space-y-4', containerClassName)}>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{question.title}</h2>
        {question.description && (
          <span className="text-muted-foreground">{question.description}</span>
        )}
      </div>
      <RadioGroup
        value={value?.toString() || ''}
        onValueChange={(val) => onChange(val as T)}
        className="flex flex-col gap-2 p-1 sm:gap-4 sm:flex-row sm:items-stretch"
        disabled={disabled}
      >
        {question.options.map(renderOption)}
      </RadioGroup>
    </div>
  );
}
