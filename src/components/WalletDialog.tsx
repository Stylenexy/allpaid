import { useId, useLayoutEffect, useRef, type ComponentProps } from 'react';
import { WizardConnectQRDialog } from '@wizardconnect/react';

/** Add keyboard and focus handling to the library's portal dialog. */
export function WalletDialog({ show, onClose, className, ...props }: ComponentProps<typeof WizardConnectQRDialog>) {
  const dialogClass = `wc-dialog-${useId()}`;
  const closeRef = useRef(onClose);

  useLayoutEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    if (!show) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // className belongs to the portal backdrop; its child is the dialog surface.
    const dialog = document.getElementsByClassName(dialogClass)[0]?.firstElementChild;
    dialog?.setAttribute('role', 'dialog');
    dialog?.setAttribute('aria-modal', 'true');
    dialog?.setAttribute('aria-label', 'Connect a wallet');
    const closeButton = dialog?.querySelector<HTMLButtonElement>('button[aria-label="Close"]')
      ?? dialog?.querySelector<HTMLButtonElement>('button');
    closeButton?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [show, dialogClass]);

  return <WizardConnectQRDialog {...props} show={show} onClose={onClose} className={`wc-dialog ${dialogClass}${className ? ` ${className}` : ''}`} />;
}
