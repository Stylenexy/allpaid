// Jar configuration: who is in the group, their payout address and their share.
// The whole configuration lives in the page URL (after the #), so there is no
// server and no database. The contract address is computed from it in the browser.
//
// A member can itself be a jar (a "nested jar"): the band's jar pays the crew's
// jar, which splits again. The contract does not care: every member is just a
// locking bytecode, and a jar's address is a P2SH32 locking bytecode like any other.
import { binToBase64, base64ToBin, binToHex, cashAddressToLockingBytecode, utf8ToBin, binToUtf8 } from '@bitauth/libauth';

export type Net = 'mainnet' | 'chipnet' | 'sandbox';

export interface Member {
  name: string;
  /**
   * CashAddress (bitcoincash:… on mainnet, bchtest:… on chipnet). For a nested
   * jar this is the child jar's own address, filled in by resolveJar() in chain.ts.
   */
  address: string;
  /** Share in basis points: 100 = 1%. All members add up to 10000. */
  bps: number;
  /** Set when this member is another jar that splits again. */
  jar?: SubJar;
}

/** A nested jar. It inherits the network of its parent. */
export interface SubJar {
  name: string;
  members: Member[];
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
/** Levels of jars one payment may flow through: organiser jar, band jar, crew jar. */
export const MAX_DEPTH = 3;

export const prefixFor = (net: Net): 'bitcoincash' | 'bchtest' => (net === 'mainnet' ? 'bitcoincash' : 'bchtest');

export const subConfig = (parent: JarConfig, member: Member): JarConfig => ({
  name: member.jar!.name,
  net: parent.net,
  members: member.jar!.members,
});

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

const splittable = (payment: bigint, bps: number[], mins: bigint[], fee: bigint) =>
  splitPot(payment, bps, fee).every((s, i) => s >= mins[i]);

/**
 * Smallest payment from which every larger payment can be split, with each
 * member getting at least its minimum (MIN_SHARE for a wallet; for a nested jar,
 * enough for that jar to split again).
 */
export function minPayment(bps: number[], fee: bigint = SPLIT_FEE, mins: bigint[] = bps.map(() => MIN_SHARE)): bigint {
  // Any pot with pot * bps_i / 10000 >= min_i + 1 for every member is always
  // splittable: floor rounding takes less than one satoshi from each earlier
  // member, and the last member's remainder is never below its exact share.
  let safePot = 0n;
  bps.forEach((b, i) => {
    const need = ((mins[i] + 1n) * BigInt(TOTAL_BPS) + BigInt(b) - 1n) / BigInt(b);
    if (need > safePot) safePot = need;
  });
  let payment = safePot + fee;
  while (splittable(payment - 1n, bps, mins, fee)) payment -= 1n;
  return payment;
}

/** Minimum payment for a whole jar, nested jars included. */
export function minPaymentFor(members: Member[]): bigint {
  const mins = members.map((m) => (m.jar ? minPaymentFor(m.jar.members) : MIN_SHARE));
  return minPayment(
    members.map((m) => m.bps),
    SPLIT_FEE,
    mins,
  );
}

/** Wallets paid by one payment into this jar, counting through nested jars. */
export function walletCount(members: Member[]): number {
  return members.reduce((n, m) => n + (m.jar ? walletCount(m.jar.members) : 1), 0);
}

/** Levels of splitting: 1 for a plain jar, 2 when a member is a jar. */
export function levelCount(members: Member[]): number {
  return 1 + Math.max(0, ...members.map((m) => (m.jar ? levelCount(m.jar.members) : 0)));
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

function validateMembers(members: Member[], net: Net, where: string, depth: number): Problem[] {
  const problems: Problem[] = [];
  const n = members.length;
  if (n < MIN_MEMBERS || n > MAX_MEMBERS) {
    problems.push({ field: `${where}members`, message: `A jar pays ${MIN_MEMBERS} to ${MAX_MEMBERS} members.` });
  }
  const prefix = prefixFor(net);
  const seen = new Set<string>();
  members.forEach((m, i) => {
    const f = `${where}m${i}`;
    const label = where ? `${where.replace(/\.$/, '')} member ${i + 1}` : `Member ${i + 1}`;
    if (!m.name.trim()) problems.push({ field: `${f}.name`, message: `${label} needs a name.` });
    if (m.jar) {
      if (depth >= MAX_DEPTH - 1) {
        problems.push({ field: `${f}.address`, message: `${label}: too deep. A payment splits over ${MAX_DEPTH} levels at most.` });
      } else {
        if (!m.jar.name.trim()) problems.push({ field: `${f}.address`, message: `${label}: the nested jar needs a name.` });
        problems.push(...validateMembers(m.jar.members, net, `${f}.`, depth + 1).map((p) => ({ ...p, field: `${f}.address`, message: `${m.name || label} (nested jar): ${p.message}` })));
      }
    } else {
      const address = m.address.trim();
      if (!address) {
        problems.push({ field: `${f}.address`, message: `${label} needs a payout address.` });
      } else if (!address.startsWith(`${prefix}:`)) {
        problems.push({ field: `${f}.address`, message: `${label}: use a ${prefix}: address for ${net === 'mainnet' ? 'mainnet' : 'chipnet'}.` });
      } else {
        const lock = lockingBytecodeOf(address);
        if (typeof lock === 'string') {
          problems.push({ field: `${f}.address`, message: `${label}: this address does not check out.` });
        } else {
          const key = binToHex(lock);
          if (seen.has(key)) problems.push({ field: `${f}.address`, message: `${label} repeats an address.` });
          seen.add(key);
        }
      }
    }
    if (!Number.isInteger(m.bps) || m.bps < 100) {
      problems.push({ field: `${f}.bps`, message: `${label} needs at least 1%.` });
    }
  });
  const total = members.reduce((sum, m) => sum + m.bps, 0);
  if (total !== TOTAL_BPS) {
    problems.push({ field: `${where}bps`, message: `Shares add up to ${(total / 100).toFixed(2)}%. They must add up to 100%.` });
  }
  return problems;
}

export function validateJar(config: JarConfig): Problem[] {
  const problems: Problem[] = [];
  if (!config.name.trim()) problems.push({ field: 'name', message: 'Give the jar a name.' });
  if (config.name.length > 40) problems.push({ field: 'name', message: 'Keep the name under 40 characters.' });
  return [...problems, ...validateMembers(config.members, config.net, '', 0)];
}

/** Constructor arguments for Splitjar.cash, in contract order. Nested members must be resolved first. */
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
// reaches a server log. A wallet member is [name, address, bps]; a nested jar
// member is [name, "", bps, { n, m }].
// ---------------------------------------------------------------------------
const NET_CODE: Record<Net, string> = { mainnet: 'm', chipnet: 'c', sandbox: 's' };
const CODE_NET: Record<string, Net> = { m: 'mainnet', c: 'chipnet', s: 'sandbox' };

type Row = [string, string, number] | [string, string, number, { n: string; m: Row[] }];

const toRows = (members: Member[], prefix: string): Row[] =>
  members.map((m) =>
    m.jar
      ? [m.name.trim(), '', m.bps, { n: m.jar.name.trim(), m: toRows(m.jar.members, prefix) }]
      : [m.name.trim(), m.address.trim().replace(`${prefix}:`, ''), m.bps],
  );

const fromRows = (rows: unknown[][], prefix: string): Member[] =>
  rows.map((row) => {
    const sub = row[3] as { n?: unknown; m?: unknown } | undefined;
    const member: Member = { name: String(row[0] ?? ''), address: row[1] ? `${prefix}:${String(row[1])}` : '', bps: Number(row[2] ?? 0) };
    if (sub && Array.isArray(sub.m)) member.jar = { name: String(sub.n ?? ''), members: fromRows(sub.m as unknown[][], prefix) };
    return member;
  });

export function encodeJar(config: JarConfig): string {
  const prefix = prefixFor(config.net);
  const compact = { v: 1, n: config.name.trim(), t: NET_CODE[config.net], m: toRows(config.members, prefix) };
  return binToBase64(utf8ToBin(JSON.stringify(compact))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeJar(code: string): JarConfig | null {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = JSON.parse(binToUtf8(base64ToBin(padded)));
    if (raw?.v !== 1 || !Array.isArray(raw.m)) return null;
    const net = CODE_NET[raw.t] ?? 'mainnet';
    return { name: String(raw.n ?? ''), net, members: fromRows(raw.m, prefixFor(net)) };
  } catch {
    return null;
  }
}

/** Pull the jar code out of a pasted jar link (…/jar#code), or null if it is not one. */
export function jarCodeFromLink(text: string): string | null {
  const match = /\/jar#([A-Za-z0-9_-]+)/.exec(text.trim());
  return match ? match[1] : null;
}
