import { useId, useLayoutEffect, useRef, type ComponentProps } from 'react';
import { WizardConnectQRDialog } from '@wizardconnect/react';

/** The pairing dialog dressed like the inner pages. It renders outside them, so no CSS variables. */
export const WALLET_THEME = {
  backdropColor: 'rgba(4, 5, 6, 0.8)',
  dialogBackground: '#111315',
  headerBackground: '#111315',
  titleColor: '#f2f3f3',
  subtitleColor: 'rgba(242, 243, 243, 0.72)',
  qrForeground: '#0d0d0d', // canvas: CSS variables do not resolve here (--qr-ink)
  qrBackground: '#ffffff', // (--qr-bg)
  uriRowBackground: '#0a0b0c',
  uriTextColor: 'rgba(242, 243, 243, 0.72)',
  borderColor: 'rgba(255, 255, 255, 0.12)',
  closeButtonColor: 'rgba(242, 243, 243, 0.78)',
  copyButtonColor: '#0ac18e',
  qrSize: 260,
};

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
