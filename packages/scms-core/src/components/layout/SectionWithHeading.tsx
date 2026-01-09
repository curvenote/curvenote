import { cn } from '../../utils/index.js';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../ui/Accordion.js';
import React from 'react';

interface SectionWithHeadingProps {
  children: React.ReactNode;
  heading: React.ReactNode;
  className?: string;
  /**
   * Icon to display in the section heading.
   * Can be a React node, a function that returns a React node, or a component type.
   * If a function or a Lucide Icon (unrendered), it will be called with the className 'w-5 h-5 stroke-[1.5px]'.
   */
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  dropdown?: boolean;
  defaultOpen?: boolean;
}

export function SectionWithHeading({
  children,
  heading,
  className,
  icon,
  dropdown = false,
  defaultOpen = false,
}: SectionWithHeadingProps) {
  const iconElement = React.isValidElement(icon)
    ? icon
    : typeof icon === 'function' || (typeof icon === 'object' && icon !== null)
      ? React.createElement(icon as React.ComponentType<{ className?: string }>, {
          className: 'w-5 h-5 stroke-[1.5px]',
        })
      : null;
  if (dropdown) {
    return (
      <Accordion
        type="single"
        collapsible
        defaultValue={defaultOpen ? 'section' : undefined}
        className={cn(className)}
      >
        <AccordionItem value="section">
          <AccordionTrigger className="text-lg font-light align-middle cursor-pointer">
            <div className="flex items-center gap-2">
              {iconElement && <span className="flex items-center align-middle">{iconElement}</span>}
              {heading}
            </div>
          </AccordionTrigger>
          <AccordionContent>{children}</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  return (
    <div className={cn(className)}>
      <div className="flex items-center gap-2 my-4">
        {iconElement && <span className="flex items-center align-middle">{iconElement}</span>}
        <h2 className="w-full text-lg font-light align-middle font-base">{heading}</h2>
      </div>
      {children}
    </div>
  );
}
