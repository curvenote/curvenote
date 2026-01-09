import { cn } from '../utils/index.js';

interface LoadingSpinnerProps {
  className?: string;
  size?: number;
  color?: string;
  thickness?: number;
}

export function LoadingSpinner({
  className,
  size = 24,
  color = 'text-gray-400',
  thickness = 3,
}: LoadingSpinnerProps) {
  // Calculate the stroke width based on the size to maintain proportions
  // Use provided thickness or calculate based on size
  const strokeWidth = thickness ?? Math.max(2, Math.round(size / 12));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  return (
    <svg
      className={cn('animate-spin', color, className)}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="opacity-25"
      />
      {/* Spinning arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * 0.75}
        strokeLinecap="round"
        className="opacity-100"
      />
    </svg>
  );
}
