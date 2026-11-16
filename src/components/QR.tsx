import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** A QR code as inline SVG, dark modules on paper so every phone camera reads it. */
export function QR({ value, label, size = 240 }: { value: string; label: string; size?: number }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1b1a17', light: '#00000000' } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(''));
    return () => {
      alive = false;
    };
  }, [value]);
  return (
    <div
      className="qr"
      role="img"
      aria-label={label}
      style={{ width: size, maxWidth: '100%', aspectRatio: '1' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
