export const SATS_PER_BCH = 100_000_000n;

/** 123456n -> "0.00123456" with trailing zeros trimmed (at least 3 decimals kept for readability). */
export function bch(sats: bigint, minDecimals = 3): string {
  const negative = sats < 0n;
  const abs = negative ? -sats : sats;
  const whole = abs / SATS_PER_BCH;
  let frac = (abs % SATS_PER_BCH).toString().padStart(8, '0');
  while (frac.length > minDecimals && frac.endsWith('0')) frac = frac.slice(0, -1);
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

/** BIP21 amounts are plain decimal BCH without trailing zeros. */
export function bip21Amount(sats: bigint): string {
  return bch(sats, 0).replace(/\.$/, '');
}

export function sats(n: bigint): string {
  return n.toLocaleString('en-US');
}

export function shortHash(hash: string, head = 6, tail = 4): string {
  return hash.length <= head + tail + 1 ? hash : `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function shortAddress(address: string): string {
  const [prefix, body] = address.includes(':') ? address.split(':') : ['', address];
  if (!body) return address;
  return `${prefix ? `${prefix}:` : ''}${body.slice(0, 6)}…${body.slice(-6)}`;
}

export function percent(bps: number): string {
  const value = bps / 100;
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace(/0+$/, '')}%`;
}

/** Parse a user-typed BCH amount ("0.001") into satoshis. Returns null if it is not a number. */
export function parseBch(text: string): bigint | null {
  const clean = text.trim().replace(',', '.');
  if (!/^\d*(\.\d{0,8})?$/.test(clean) || clean === '' || clean === '.') return null;
  const [whole, frac = ''] = clean.split('.');
  return BigInt(whole || '0') * SATS_PER_BCH + BigInt(frac.padEnd(8, '0'));
}
