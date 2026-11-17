// Share arithmetic and jar limits, with no runtime dependencies so the landing
// page can use them without loading the Bitcoin Cash libraries.
// jar.ts re-exports everything here.

/** Network fee the contract takes from each payment when it is split (satoshis). */
export const SPLIT_FEE = 1000n;
/** The contract refuses to create a payout below this many satoshis. */
export const MIN_SHARE = 1000n;
export const MIN_MEMBERS = 2;
export const MAX_MEMBERS = 4;
export const TOTAL_BPS = 10000;
/** Levels of jars one payment may flow through: organiser jar, band jar, crew jar. */
export const MAX_DEPTH = 3;

/** The part of a member that share arithmetic needs: its share and, for a nested jar, its members. */
export interface ShareNode {
  name?: string;
  bps: number;
  jar?: { name?: string; members: ShareNode[] };
}

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
export function minPaymentFor(members: ShareNode[]): bigint {
  const mins = members.map((m) => (m.jar ? minPaymentFor(m.jar.members) : MIN_SHARE));
  return minPayment(
    members.map((m) => m.bps),
    SPLIT_FEE,
    mins,
  );
}

/** Wallets paid by one payment into this jar, counting through nested jars. */
export function walletCount(members: ShareNode[]): number {
  return members.reduce((n, m) => n + (m.jar ? walletCount(m.jar.members) : 1), 0);
}

/** Levels of splitting: 1 for a plain jar, 2 when a member is a jar. */
export function levelCount(members: ShareNode[]): number {
  return 1 + Math.max(0, ...members.map((m) => (m.jar ? levelCount(m.jar.members) : 0)));
}

/**
 * The on-chain contract does not check the shares: it pays the first members
 * their basis points and the last member whatever is left. A jar whose shares
 * do not add up to exactly 10,000 basis points could therefore never split, and
 * coins sent to it would stay locked. Returns the problem, or null when the
 * shares of this jar are safe. Nested jars are checked when their own contract
 * is made.
 */
export function sharesProblem(name: string, members: ShareNode[]): string | null {
  const label = name.trim() || 'This jar';
  if (members.length < MIN_MEMBERS || members.length > MAX_MEMBERS) {
    return `${label}: a jar pays ${MIN_MEMBERS} to ${MAX_MEMBERS} members, not ${members.length}.`;
  }
  const bad = members.find((m) => !Number.isInteger(m.bps) || m.bps <= 0);
  if (bad) return `${label}: every share must be a whole number of basis points above 0 (got ${bad.bps}).`;
  const total = members.reduce((sum, m) => sum + m.bps, 0);
  if (total !== TOTAL_BPS) {
    return `${label}: shares add up to ${total} basis points. They must add up to exactly ${TOTAL_BPS} (100%), or coins paid to this jar could be locked for good.`;
  }
  return null;
}
