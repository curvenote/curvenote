import type { ReactNode } from 'react';
import { useState, useEffect, useRef } from 'react';
import { WizardProgress } from './WizardProgress.js';
import type { WizardQuestion } from './WizardQuestion.js';
import { Button } from '../ui/button.js';
import { cn } from '../../utils/cn.js';

/**
 * Generic outcome interface for wizard results
 */
export interface WizardOutcome {
  id: string;
  title: string;
  text?: string;
  type: string;
  subType?: string;
}

/**
 * Logic functions that must be provided for each wizard implementation
 */
export interface WizardLogic<TState> {
  /**
   * Create initial state for the wizard
   */
  createInitialState: () => TState;

  /**
   * Determine if a question should be shown based on current state
   */
  shouldShowQuestion: (questionId: string, state: TState) => boolean;

  /**
   * Check if the wizard is complete (all required questions answered)
   */
  isComplete: (state: TState) => boolean;

  /**
   * Compute final outcomes based on completed state
   */
  computeOutcome: (state: TState) => { outcomes: string[] };

  /**
   * Handle conditional state changes when answers change
   * (e.g., clear dependent questions)
   */
  handleStateChange?: (questionId: string, value: any, prevState: TState) => Partial<TState>;

  /**
   * Get the first question ID to start with
   */
  getFirstQuestion: () => string;
}

/**
 * Complete wizard configuration
 */
export interface WizardConfig<TState> {
  questions: Record<string, WizardQuestion>;
  questionOrder?: string[];
  outcomes: Record<string, WizardOutcome>;
  logic: WizardLogic<TState>;
}

interface WizardProps<TState> {
  config: WizardConfig<TState>;
  questionRenderer: (props: {
    question: WizardQuestion;
    value: any;
    onChange: (value: any) => void;
    disabled: boolean;
  }) => ReactNode;
  outcomeRenderer: (outcomes: WizardOutcome[]) => ReactNode;
  containerClassName?: string;
  progressClassName?: string;
  onComplete?: (state: TState, outcomes: string[]) => void;
  onFinish?: () => void;
  onStartOver?: () => void;
  completionScrollTarget?: string; // CSS selector or element ID to scroll to on completion
  renderAdditionalControls?: (isCompleted: boolean, isFirstQuestion: boolean) => ReactNode;
}

/**
 * Generic Wizard: Reusable wizard orchestrator for multi-step forms
 *
 * Handles the common wizard patterns:
 * - Progressive question disclosure
 * - State management and persistence
 * - Conditional question logic
 * - Smooth animations and transitions
 * - Always-editable mode after first completion
 * - Start over functionality
 *
 * Domain-specific behavior is injected through the config's logic functions,
 * making this component reusable across different wizard types.
 *
 * @param config - Complete wizard configuration with questions, outcomes, and logic
 * @param questionRenderer - Function to render individual questions
 * @param outcomeRenderer - Function to render final outcomes
 * @param onComplete - Optional callback when wizard is completed
 * @param finishButton - Optional custom finish button
 */

export function Wizard<TState extends Record<string, any>>({
  config,
  questionRenderer,
  outcomeRenderer,
  containerClassName,
  progressClassName,
  onComplete,
  onFinish,
  onStartOver,
  completionScrollTarget,
  renderAdditionalControls = () => null,
}: WizardProps<TState>) {
  // Core wizard state: tracks answers to all questions
  const [state, setState] = useState<TState>(config.logic.createInitialState());

  // UI state: which question is currently being asked
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(
    config.logic.getFirstQuestion(),
  );

  // Final results: array of outcome IDs when wizard is complete
  const [outcomes, setOutcomes] = useState<string[]>([]);

  // Track if wizard has ever been completed (to enable always-editable mode)
  const [hasBeenCompleted, setHasBeenCompleted] = useState(false);

  // Animation states for smooth transitions
  const [outcomesVisible, setOutcomesVisible] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [contentVisible, setContentVisible] = useState(true);

  // Ref for scrolling to the current question
  const currentQuestionRef = useRef<HTMLDivElement>(null);

  /**
   * Core wizard logic: determines current question or final outcomes
   */
  useEffect(() => {
    const wizardComplete = config.logic.isComplete(state);

    if (wizardComplete) {
      // All questions answered: compute final outcomes
      const result = config.logic.computeOutcome(state);
      setOutcomes(result.outcomes);

      // Mark as completed if this is the first time
      if (!hasBeenCompleted) {
        setHasBeenCompleted(true);
      }

      // After first completion, don't change currentQuestion (keep all questions active)
      if (!hasBeenCompleted) {
        setCurrentQuestion(null);
      }

      // Call completion callback
      if (onComplete) {
        onComplete(state, result.outcomes);
      }
    } else {
      // Wizard incomplete
      if (hasBeenCompleted) {
        // Already completed before - clear outcomes but keep questions active
        // cirical in cases where an answer may add or remove a question
        setOutcomes([]);
      } else {
        // First time through - find next unanswered question
        const questionOrder = config.questionOrder || Object.keys(config.questions);
        for (const questionId of questionOrder) {
          if (state[questionId] === null || state[questionId] === undefined) {
            if (config.logic.shouldShowQuestion(questionId, state)) {
              setCurrentQuestion(questionId);
              break;
            }
          }
        }
      }
    }
  }, [state, config, hasBeenCompleted, onComplete]);

  // Trigger fade-in animation when outcomes are set
  useEffect(() => {
    if (outcomes.length > 0) {
      const timer = setTimeout(() => {
        setOutcomesVisible(true);
        // Scroll to completion target if specified (only on first completion)
        if (completionScrollTarget && !outcomesVisible) {
          // Wait for content to fully render and stabilize before scrolling
          setTimeout(() => {
            const targetElement = completionScrollTarget.startsWith('#')
              ? document.getElementById(completionScrollTarget.slice(1))
              : document.querySelector(completionScrollTarget);
            if (targetElement) {
              // Calculate position with offset for spacing at top
              const elementTop = targetElement.getBoundingClientRect().top + window.pageYOffset;
              const offset = 40; // 40px scroll padding from top
              window.scrollTo({
                top: elementTop - offset,
                behavior: 'smooth',
              });
            }
          }, 300); // Additional delay to ensure content is fully stable
        }
      }, 100); // Initial delay to make outcomes visible
      return () => clearTimeout(timer);
    } else {
      setOutcomesVisible(false);
    }
  }, [outcomes, completionScrollTarget, outcomesVisible]);

  const handleAnswerChange = (questionId: string, value: any) => {
    setState((prev) => {
      let newState = {
        ...prev,
        [questionId]: value,
      };

      // Apply any conditional state changes
      if (config.logic.handleStateChange) {
        const stateChanges = config.logic.handleStateChange(questionId, value, prev);
        newState = { ...newState, ...stateChanges };
      }

      // Scroll to current question after a short delay to allow state update
      // Only scroll if wizard hasn't been completed yet (disable scroll for edits after completion)
      setTimeout(() => {
        if (currentQuestionRef.current && !config.logic.isComplete(newState) && !hasBeenCompleted) {
          const elementTop =
            currentQuestionRef.current.getBoundingClientRect().top + window.pageYOffset;
          const offset = 40; // 40px scroll padding from top
          window.scrollTo({
            top: elementTop - offset,
            behavior: 'smooth',
          });
        }
      }, 100);

      return newState;
    });
  };

  /**
   * Reset wizard with smooth animation
   */
  const handleStartOver = () => {
    // Call custom onStartOver handler if provided
    if (onStartOver) {
      onStartOver();
    }

    setIsResetting(true);
    setContentVisible(false);

    setTimeout(() => {
      setState(config.logic.createInitialState());
      setCurrentQuestion(config.logic.getFirstQuestion());
      setOutcomes([]);
      setOutcomesVisible(false);
      setHasBeenCompleted(false);

      setTimeout(() => {
        setIsResetting(false);
        setContentVisible(true);
      }, 50);
    }, 100);
  };

  const getVisibleQuestions = () => {
    const questionOrder = config.questionOrder || Object.keys(config.questions);
    return questionOrder.filter((questionId) => config.logic.shouldShowQuestion(questionId, state));
  };

  const visibleQuestions = getVisibleQuestions();
  const answeredQuestions = visibleQuestions.filter(
    (q) => state[q] !== null && state[q] !== undefined,
  );

  // Get questions to display
  const questionsToDisplay: string[] = [];

  if (hasBeenCompleted) {
    // After first completion: show all visible questions (all are editable)
    questionsToDisplay.push(...visibleQuestions);
  } else {
    // First time through: show answered questions + current question
    for (const questionId of visibleQuestions) {
      const value = state[questionId];
      if (value !== null && value !== undefined) {
        questionsToDisplay.push(questionId);
      }
    }

    // Add current question if not already included
    if (currentQuestion && !questionsToDisplay.includes(currentQuestion)) {
      questionsToDisplay.push(currentQuestion);
    }
  }

  // Don't render anything while resetting
  if (isResetting) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="opacity-0" />
      </div>
    );
  }

  return (
    <div
      className={`space-y-12 transition-all duration-600 ease-in-out ${
        contentVisible ? 'opacity-100' : 'opacity-0'
      } ${containerClassName || ''}`}
    >
      {/* Questions */}
      {questionsToDisplay.map((questionId) => {
        const question = config.questions[questionId];
        const questionValue = state[questionId];

        if (!question) {
          return null; // Skip if question not found in config
        }

        return (
          <div
            key={questionId}
            ref={currentQuestion === questionId ? currentQuestionRef : undefined}
            className={`transition-all duration-700 ease-in-out ${
              contentVisible ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              transitionDelay: contentVisible
                ? `${questionsToDisplay.indexOf(questionId) * 150}ms`
                : '0ms',
            }}
          >
            {questionRenderer({
              question,
              value: questionValue,
              onChange: (value) => handleAnswerChange(questionId, value),
              disabled: false,
            })}
          </div>
        );
      })}

      {/* Progress indicator */}
      <div
        className={`mt-16 transition-all duration-700 ease-in-out transform ${
          contentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
        style={{
          transitionDelay: contentVisible ? `${questionsToDisplay.length * 150 + 200}ms` : '0ms',
        }}
      >
        <WizardProgress
          className={progressClassName}
          currentStep={answeredQuestions.length + 1}
          totalSteps={visibleQuestions.length}
          answeredSteps={answeredQuestions.length}
          isFirstQuestion={answeredQuestions.length === 0}
          onStartOver={handleStartOver}
          onFinish={onFinish}
          renderAdditionalControls={renderAdditionalControls}
        />
      </div>

      {/* Outcomes */}
      {outcomes.length > 0 && (
        <div
          className={`transform transition-all duration-1000 ease-in-out ${
            outcomesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="space-y-6">
            {outcomeRenderer(outcomes.map((id) => config.outcomes[id]))}

            <div className={cn('flex gap-4 justify-end', progressClassName)}>
              <Button onClick={onFinish} variant="link">
                Finish
              </Button>
              <Button onClick={handleStartOver} variant="link">
                Start Over
              </Button>
              {renderAdditionalControls(true, false)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
