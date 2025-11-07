'use client';

import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';
import { cloneElement, isValidElement } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { dispatchWalletModalOpen } from '@/lib/wallet-events';

type ConnectWalletButtonProps = {
  className?: string;
  disabled?: boolean;
  idleLabel?: ReactNode;
  pendingLabel?: ReactNode;
  asChild?: boolean;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'className' | 'children'>;

export function ConnectWalletButton({
  className,
  disabled,
  idleLabel,
  pendingLabel,
  asChild,
  children,
  ...rest
}: ConnectWalletButtonProps) {
  const { isConnected } = useAccount();
  const { connect, connectors, status } = useConnect();

  if (isConnected) {
    return null;
  }

  const farcasterConnector =
    connectors.find(
      (connector) =>
        connector.id?.toLowerCase().includes('farcaster') ||
        connector.name?.toLowerCase().includes('farcaster'),
    ) ?? connectors[0];

  const handleClick = () => {
    if (!farcasterConnector) {
      return;
    }
    dispatchWalletModalOpen();
    connect({ connector: farcasterConnector });
  };

  const buttonDisabled = disabled || !farcasterConnector || status === 'pending';
  const label = status === 'pending' ? pendingLabel ?? 'Connecting…' : idleLabel ?? 'Connect Wallet';

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;
    const mergedDisabled = buttonDisabled || Boolean(child.props.disabled);
    return cloneElement(
      child,
      {
        ...child.props,
        ...rest,
        disabled: mergedDisabled,
        onClick: (event) => {
          child.props.onClick?.(event);
          if (event.defaultPrevented) {
            return;
          }
          handleClick();
        },
      },
      label,
    );
  }

  return (
    <button
      type="button"
      className={className}
      disabled={buttonDisabled}
      onClick={handleClick}
      {...rest}
    >
      {label}
    </button>
  );
}
