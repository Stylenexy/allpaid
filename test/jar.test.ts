import { describe, expect, it } from 'vitest';
import { decodeJar, encodeJar, splitPot, validateJar, type JarConfig } from '../src/lib/jar';
import { jarAddress } from '../src/lib/chain';
import { sampleAddress, SAMPLE_BAND } from '../src/lib/sample';

const mainnetJar: JarConfig = {
  name: 'Warung Bu Sri',
  net: 'mainnet',
  members: [
    { name: 'Sri', address: sampleAddress('sri', 'bitcoincash'), bps: 6000 },
    { name: 'Dodi', address: sampleAddress('dodi', 'bitcoincash'), bps: 4000 },
  ],
};

describe('jar link', () => {
  it('survives a round trip through the URL', () => {
    for (const config of [mainnetJar, SAMPLE_BAND]) {
      const code = encodeJar(config);
      expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(decodeJar(code)).toEqual(config);
    }
  });

  it('gives the same contract address after the round trip', () => {
    const again = decodeJar(encodeJar(mainnetJar))!;
    expect(jarAddress(again)).toBe(jarAddress(mainnetJar));
    expect(jarAddress(mainnetJar)).toMatch(/^bitcoincash:p/);
  });

  it('returns null for a broken link instead of throwing', () => {
    expect(decodeJar('not-a-jar')).toBeNull();
    expect(decodeJar('')).toBeNull();
  });
});

describe('jar checks', () => {
  it('accepts a valid jar', () => {
    expect(validateJar(mainnetJar)).toEqual([]);
    expect(validateJar(SAMPLE_BAND)).toEqual([]);
  });

  it('catches shares that do not add up to 100%', () => {
    const bad = { ...mainnetJar, members: mainnetJar.members.map((m) => ({ ...m, bps: 4000 })) };
    expect(validateJar(bad).map((p) => p.field)).toContain('bps');
  });

  it('catches an address from the wrong network', () => {
    const bad = { ...mainnetJar, net: 'chipnet' as const };
    expect(validateJar(bad).some((p) => p.field === 'm0.address')).toBe(true);
  });

  it('catches a typo in an address', () => {
    const typo = mainnetJar.members[0].address.slice(0, -1) + (mainnetJar.members[0].address.endsWith('q') ? 'p' : 'q');
    const bad = { ...mainnetJar, members: [{ ...mainnetJar.members[0], address: typo }, mainnetJar.members[1]] };
    expect(validateJar(bad).some((p) => p.field === 'm0.address')).toBe(true);
  });

  it('catches the same address twice, too many members, and a missing name', () => {
    const twice = { ...mainnetJar, members: [mainnetJar.members[0], { ...mainnetJar.members[0], name: 'Again' }] };
    expect(validateJar(twice).some((p) => p.message.includes('repeats'))).toBe(true);
    const five = { ...SAMPLE_BAND, members: Array.from({ length: 5 }, (_, i) => ({ ...SAMPLE_BAND.members[0], bps: 2000, address: sampleAddress(`x${i}`) })) };
    expect(validateJar(five).some((p) => p.field === 'members')).toBe(true);
    expect(validateJar({ ...mainnetJar, name: ' ' }).some((p) => p.field === 'name')).toBe(true);
  });
});

describe('split arithmetic', () => {
  it('never loses or invents a satoshi', () => {
    const bps = [3700, 2900, 2100, 1300];
    for (let payment = 20_000n; payment < 20_500n; payment += 7n) {
      const shares = splitPot(payment, bps);
      expect(shares.reduce((a, b) => a + b, 0n)).toBe(payment - 1000n);
    }
  });
});
