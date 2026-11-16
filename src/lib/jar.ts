// Jar configuration: who is in the group, their payout address and their share.
// The whole configuration lives in the page URL (after the #), so there is no
// server and no database. The contract address is computed from it in the browser.
import {
  binToBase64,
  base64ToBin,
  binToHex,
  cashAddressToLockingBytecode,
  utf8ToBin,
  binToUtf8,
} from '@bitauth/libauth';

export type Net = 'mainnet' | 'chipnet' | 'sandbox';

export interface Member {
  name: string;
  /** CashAddress (bitcoincash:… on mainnet, bchtest:… on chipnet). */
  address: string;
  /** Share in basis points: 100 = 1%. All members add up to 10000. */
  bps: number;
}

export interface JarConfig {
  name: string;
  net: Net;
  members: Member[];
}

/** Network fee the contract takes from each payment when it is split (satoshis). */
export const SPLIT_FEE = 1000n;
/** The contract refuses to create a payout below this many satoshis. */
export const MIN_SHARE = 1000n;
export const MIN_MEMBERS = 2;
export const MAX_MEMBERS = 4;
export const TOTAL_BPS = 10000;

export const prefixFor = (net: Net): 'bitcoincash' | 'bchtest' =>
  net === 'mainnet' ? 'bitcoincash' : 'bchtest';

/** Split a payment exactly like the contract does. Last member gets the remainder. */
export function splitPot(paymentSats: bigint, bps: number[], fee: bigint = SPLIT_FEE): bigint[] {
  const pot = paymentSats - fee;
  const shares: bigint[] = [];
  let given = 0n;
  for (let i = 0; i < bps.length - 1; i += 1) {
    const share = (pot * BigInt(bps[i])) / BigInt(TOTAL_BPS);
    shares.push(share);
    given += share;
  }
  shares.push(pot - given);
  return shares;
}

const splittable = (payment: bigint, bps: number[], fee: bigint) =>
  splitPot(payment, bps, fee).every((s) => s >= MIN_SHARE);

/**
 * Smallest payment from which every larger payment can be split, with each
 * member getting at least MIN_SHARE.
 */
export function minPayment(bps: number[], fee: bigint = SPLIT_FEE): bigint {
  const smallest = BigInt(Math.min(...bps));
  // Any pot >= ceil((MIN_SHARE + 1) * 10000 / smallest) is always splittable:
  // floor rounding takes less than one satoshi from each earlier member, and
  // the last member's remainder is never below its exact share.
  const safePot = ((MIN_SHARE + 1n) * BigInt(TOTAL_BPS) + smallest - 1n) / smallest;
  let payment = safePot + fee;
  while (splittable(payment - 1n, bps, fee)) payment -= 1n;
  return payment;
}

export interface Problem {
  field: string;
  message: string;
}

export function lockingBytecodeOf(address: string): Uint8Array | string {
  const decoded = cashAddressToLockingBytecode(address.trim());
  if (typeof decoded === 'string') return decoded;
  return decoded.bytecode;
}

export function validateJar(config: JarConfig): Problem[] {
  const problems: Problem[] = [];
  if (!config.name.trim()) problems.push({ field: 'name', message: 'Give the jar a name.' });
  if (config.name.length > 40) problems.push({ field: 'name', message: 'Keep the name under 40 characters.' });
  const n = config.members.length;
  if (n < MIN_MEMBERS || n > MAX_MEMBERS) {
    problems.push({ field: 'members', message: `A jar pays ${MIN_MEMBERS} to ${MAX_MEMBERS} people.` });
  }
  const prefix = prefixFor(config.net);
  const seen = new Set<string>();
  config.members.forEach((m, i) => {
    if (!m.name.trim()) problems.push({ field: `m${i}.name`, message: `Member ${i + 1} needs a name.` });
    const address = m.address.trim();
    if (!address) {
      problems.push({ field: `m${i}.address`, message: `Member ${i + 1} needs a payout address.` });
    } else if (!address.startsWith(`${prefix}:`)) {
      problems.push({
        field: `m${i}.address`,
        message: `Member ${i + 1}: use a ${prefix}: address for ${config.net === 'mainnet' ? 'mainnet' : 'chipnet'}.`,
      });
    } else {
      const lock = lockingBytecodeOf(address);
      if (typeof lock === 'string') {
        problems.push({ field: `m${i}.address`, message: `Member ${i + 1}: this address does not check out.` });
      } else {
        const key = binToHex(lock);
        if (seen.has(key)) problems.push({ field: `m${i}.address`, message: `Member ${i + 1} repeats an address.` });
        seen.add(key);
      }
    }
    if (!Number.isInteger(m.bps) || m.bps < 100) {
      problems.push({ field: `m${i}.bps`, message: `Member ${i + 1} needs at least 1%.` });
    }
  });
  const total = config.members.reduce((sum, m) => sum + m.bps, 0);
  if (total !== TOTAL_BPS) {
    problems.push({ field: 'bps', message: `Shares add up to ${(total / 100).toFixed(2)}%. They must add up to 100%.` });
  }
  return problems;
}

/** Constructor arguments for Kencleng.cash, in contract order. */
export function contractArgs(config: JarConfig): [Uint8Array, Uint8Array, Uint8Array, Uint8Array, bigint, bigint, bigint, bigint, bigint] {
  const locks = config.members.map((m) => {
    const lock = lockingBytecodeOf(m.address);
    if (typeof lock === 'string') throw new Error(`${m.name}: ${lock}`);
    return lock;
  });
  const lock = (i: number) => locks[i] ?? new Uint8Array();
  const bps = (i: number) => BigInt(config.members[i]?.bps ?? 0);
  return [lock(0), lock(1), lock(2), lock(3), bps(0), bps(1), bps(2), BigInt(config.members.length), SPLIT_FEE];
}

// ---------------------------------------------------------------------------
// URL encoding. Compact JSON in base64url, placed after the # so it never
// reaches a server log.
// ---------------------------------------------------------------------------
const NET_CODE: Record<Net, string> = { mainnet: 'm', chipnet: 'c', sandbox: 's' };
const CODE_NET: Record<string, Net> = { m: 'mainnet', c: 'chipnet', s: 'sandbox' };

export function encodeJar(config: JarConfig): string {
  const prefix = prefixFor(config.net);
  const compact = {
    v: 1,
    n: config.name.trim(),
    t: NET_CODE[config.net],
    m: config.members.map((m) => [m.name.trim(), m.address.trim().replace(`${prefix}:`, ''), m.bps]),
  };
  return binToBase64(utf8ToBin(JSON.stringify(compact))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeJar(code: string): JarConfig | null {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = JSON.parse(binToUtf8(base64ToBin(padded)));
    if (raw?.v !== 1 || !Array.isArray(raw.m)) return null;
    const net = CODE_NET[raw.t] ?? 'mainnet';
    const prefix = prefixFor(net);
    return {
      name: String(raw.n ?? ''),
      net,
      members: raw.m.map((row: unknown[]) => ({
        name: String(row[0] ?? ''),
        address: `${prefix}:${String(row[1] ?? '')}`,
        bps: Number(row[2] ?? 0),
      })),
    };
  } catch {
    return null;
  }
}
