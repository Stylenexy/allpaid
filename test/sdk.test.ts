import { describe, expect, it } from 'vitest';
import { MockNetworkProvider } from 'cashscript';
import { encodeCashAddress, hash160, utf8ToBin } from '@bitauth/libauth';
import { JarEngine, jarAddress, jarTree, makeContract, sharesProblem, validateJar, type JarConfig } from '../src/sdk';
import { jarAddress as libJarAddress } from '../src/lib/chain';
import { SAMPLE_BAND, sampleAddress } from '../src/lib/sample';
import { GAP_LIMIT, MAX_SCAN, scanWallet } from '../src/lib/wallet';

const two = (a: number, b: number): JarConfig => ({
  name: 'Duo',
  net: 'mainnet',
  members: [
    { name: 'One', address: sampleAddress('one', 'bitcoincash'), bps: a },
    { name: 'Two', address: sampleAddress('two', 'bitcoincash'), bps: b },
  ],
});

describe('the SDK refuses jars that could lock coins', () => {
  it('accepts shares that add up to 10000 and gives the same address as the app', () => {
    expect(sharesProblem('Duo', two(6000, 4000).members)).toBeNull();
    expect(jarAddress(SAMPLE_BAND)).toBe(libJarAddress(SAMPLE_BAND));
  });

  it('throws instead of making an address when the shares miss 10000 by a single basis point', () => {
    for (const [a, b] of [[6000, 3999], [6000, 4001], [10000, 0], [-100, 10100], [5000.5, 4999.5]]) {
      const config = two(a, b);
      expect(sharesProblem(config.name, config.members)).not.toBeNull();
      expect(() => jarAddress(config)).toThrow(/basis points/);
      expect(() => makeContract(config, new MockNetworkProvider())).toThrow(/basis points/);
    }
  });

  it('checks every nested jar too, before a watcher or keeper can start', () => {
    const crew = SAMPLE_BAND.members[3].jar!;
    const broken: JarConfig = {
      ...SAMPLE_BAND,
      members: SAMPLE_BAND.members.map((m, i) => (i === 3 ? { ...m, jar: { ...crew, members: crew.members.map((c, j) => (j === 0 ? { ...c, bps: 4100 } : c)) } } : m)),
    };
    expect(validateJar(broken).some((p) => p.message.includes('100%'))).toBe(true);
    expect(() => jarTree(broken)).toThrow(/Road crew: shares add up to 10100/);
    expect(() => new JarEngine(broken, 'bchtest:unused')).toThrow(/10100/);
  });

  it('refuses a member count the contract cannot pay', () => {
    const solo: JarConfig = { name: 'Solo', net: 'mainnet', members: [{ name: 'One', address: sampleAddress('one', 'bitcoincash'), bps: 10000 }] };
    expect(() => jarAddress(solo)).toThrow(/2 to 4 members/);
  });
});

describe('WizardConnect coin discovery', () => {
  const pubkey = (child: number, index: number) => utf8ToBin(`allpaid test key ${child}/${index}`);
  const address = (child: number, index: number) =>
    encodeCashAddress({ prefix: 'bchtest', type: 'p2pkh', payload: hash160(pubkey(child, index)) }).address;
  const manager = { getPubkey: (child: number, index: bigint) => pubkey(child, Number(index)) } as never;
  let n = 0;
  const fund = (provider: MockNetworkProvider, child: number, index: number, satoshis = 10_000n) =>
    provider.addUtxo(address(child, index), { txid: (n += 1).toString(16).padStart(64, '0'), vout: 0, satoshis });

  it(`follows used addresses past the first ${GAP_LIMIT} and stops after ${GAP_LIMIT} unused in a row`, async () => {
    const provider = new MockNetworkProvider();
    for (const index of [5, 22, 41, 62]) fund(provider, 0, index);
    fund(provider, 1, 3);
    const scan = await scanWallet(manager, 'chipnet', provider);
    expect(scan.coins.filter((c) => c.path === 'receive').map((c) => c.index)).toEqual([5, 22, 41]);
    expect(scan.coins.filter((c) => c.path === 'change').map((c) => c.index)).toEqual([3]);
    expect(scan.balance).toBe(40_000n);
  });

  it(`never looks past ${MAX_SCAN} addresses per path`, async () => {
    const provider = new MockNetworkProvider();
    for (let index = 0; index <= 120; index += 15) fund(provider, 0, index);
    const scan = await scanWallet(manager, 'chipnet', provider);
    expect(Math.max(...scan.coins.map((c) => c.index))).toBe(90);
    expect(scan.coins).toHaveLength(7);
  });
});
