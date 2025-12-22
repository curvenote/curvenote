'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog.js';
import { Button, type ButtonProps } from './button.js';
import { cn } from '../../utils/cn.js';
import type { DialogContentProps } from '@radix-ui/react-dialog';

export interface DialogButton {
  label: string;
  onClick: () => void;
  variant?: ButtonProps['variant'];
  disabled?: boolean;
}

export interface SimpleDialogProps
  extends Omit<DialogContentProps, 'children' | 'title' | 'description' | 'onOpenAutoFocus'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  footerButtons?: DialogButton[];
  showCloseButton?: boolean;
  variant?: 'default' | 'wide';
  onOpenAutoFocus?: (event: Event) => void;
}

/**
 * SimpleDialog: A thin wrapper around Radix Dialog with convenience props
 *
 * Provides a flexible dialog component that maintains consistent styling while
 * allowing customization of header, body, and footer content.
 *
 * @example
 * // Simple dialog with buttons
 * <SimpleDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Confirm Action"
 *   description="Are you sure you want to proceed?"
 *   footerButtons={[
 *     { label: 'Cancel', onClick: handleCancel, variant: 'outline' },
 *     { label: 'Confirm', onClick: handleConfirm }
 *   ]}
 * />
 *
 * @example
 * // Custom footer
 * <SimpleDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Custom Dialog"
 *   footer={<CustomFooterComponent />}
 * >
 *   <div>Custom body content</div>
 * </SimpleDialog>
 */
export function SimpleDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  footerButtons,
  showCloseButton = true,
  variant = 'default',
  className,
  onOpenAutoFocus,
  ...props
}: SimpleDialogProps) {
  const hasFooter = footer || (footerButtons && footerButtons.length > 0);
  const hasHeader = title || description;
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const footerRef = React.useRef<HTMLDivElement>(null);
  const titleRef = React.useRef<HTMLHeadingElement>(null);

  const handleOpenAutoFocus = React.useCallback(
    (event: Event) => {
      // Prevent default focus behavior (which would focus the close button)
      event.preventDefault();

      // If custom handler provided, call it
      if (onOpenAutoFocus) {
        onOpenAutoFocus(event);
        return;
      }

      // Small delay to ensure dialog is fully rendered
      setTimeout(() => {
        // Try to focus the first focusable element in the body
        if (bodyRef.current) {
          const focusableSelectors = [
            'input:not([disabled]):not([type="hidden"])',
            'textarea:not([disabled])',
            'select:not([disabled])',
            'button:not([disabled])',
            'a[href]',
            '[tabindex]:not([tabindex="-1"])',
          ].join(', ');

          const firstFocusable = bodyRef.current.querySelector(focusableSelectors) as HTMLElement;
          if (firstFocusable) {
            firstFocusable.focus();
            return;
          }
        }

        // If no focusable element in body, try to focus the first button in the footer
        if (footerRef.current) {
          const firstButton = footerRef.current.querySelector(
            'button:not([disabled])',
          ) as HTMLElement;
          if (firstButton) {
            firstButton.focus();
            return;
          }
        }

        // Last resort: focus the title (which is programmatically focusable)
        if (titleRef.current) {
          titleRef.current.focus();
        }
      }, 0);
    },
    [onOpenAutoFocus],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={showCloseButton}
        variant={variant}
        className={className}
        onOpenAutoFocus={handleOpenAutoFocus}
        {...props}
      >
        {hasHeader && (
          <DialogHeader>
            {title && (
              <DialogTitle ref={titleRef} tabIndex={-1}>
                {title}
              </DialogTitle>
            )}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children && (
          <div
            ref={bodyRef}
            className={cn(hasFooter && 'pb-4', !hasHeader && !hasFooter && 'py-0')}
          >
            {children}
          </div>
        )}
        {hasFooter && (
          <DialogFooter ref={footerRef}>
            {footer ||
              (footerButtons &&
                footerButtons.map((button, index) => (
                  <Button
                    key={index}
                    variant={button.variant}
                    onClick={button.onClick}
                    disabled={button.disabled}
                  >
                    {button.label}
                  </Button>
                )))}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
