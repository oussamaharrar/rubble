'use client';

import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'ghost' | 'danger';

type FancyButtonProps = HTMLMotionProps<'button'> & {
  variant?: ButtonVariant;
};

const MotionButton = motion.button;

const baseClasses =
  'relative inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold leading-6 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-sky-500/40 hover:ring-2 hover:ring-sky-200/60 focus-visible:outline-sky-300',
  ghost:
    'border border-slate-500/40 bg-slate-900/40 text-slate-100 hover:border-slate-300/60 hover:bg-slate-800/60 focus-visible:outline-slate-300',
  danger:
    'border border-rose-500/70 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25 focus-visible:outline-rose-400',
};

const hoverAnimation = { scale: 1.02 };
const tapAnimation = { scale: 0.97 };

const FancyButton = forwardRef<HTMLButtonElement, FancyButtonProps>(
  ({ className, variant = 'primary', disabled, ...props }, ref) => {
    const resolvedClassName = clsx(baseClasses, variantClasses[variant], className);
    return (
      <MotionButton
        ref={ref}
        whileHover={disabled ? undefined : hoverAnimation}
        whileTap={disabled ? undefined : tapAnimation}
        className={resolvedClassName}
        disabled={disabled}
        {...props}
      />
    );
  }
);

FancyButton.displayName = 'FancyButton';

type VariantButtonProps = Omit<FancyButtonProps, 'variant'>;

function createVariantButton(variant: ButtonVariant) {
  const Button = forwardRef<HTMLButtonElement, VariantButtonProps>((props, ref) => (
    <FancyButton {...props} ref={ref} variant={variant} />
  ));
  Button.displayName = `${variant.charAt(0).toUpperCase()}${variant.slice(1)}Button`;
  return Button;
}

export const PrimaryButton = createVariantButton('primary');
export const GhostButton = createVariantButton('ghost');
export const DangerButton = createVariantButton('danger');
