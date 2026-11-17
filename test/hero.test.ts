import { describe, expect, it, vi } from 'vitest';
import { DepositCursor } from '../src/landing/deposit-cursor';
import { demoConfig } from '../src/landing/demo-config';
import { encodeJar, type JarConfig } from '../src/lib/jar';
import { SAMPLE_BAND, sampleAddress } from '../src/lib/sample';
import { getProvider, jarAddress, sandboxPay } from '../src/lib/chain';
import { JarEngine, type JarEvent } from '../src/lib/engine';

const deposit = (id: string, node = '0'): JarEvent => ({ id, node, kind: 'in', at: 1, jarName: 'Demo', depth: 0, satoshis: 100_000n, txid: id });

describe('the payment hero', () => {
  it('never presents an absent, malformed or sandbox configuration as a real payment QR', () => {
    expect(demoConfig('')).toBeNull();
    expect(demoConfig('/jar#broken')).toBeNull();
    expect(demoConfig(`/jar#${encodeJar(SAMPLE_BAND)}`)).toBeNull();
    const config: JarConfig = { name: 'Public demo', net: 'mainnet', members: [
      { name: 'One', bps: 5000, address: sampleAddress('one', 'bitcoincash') },
      { name: 'Two', bps: 5000, address: sampleAddress('two', 'bitcoincash') },
    ] };
    expect(demoConfig(`/jar#${encodeJar(config)}`)).toEqual(config);
  });

  it('ignores the opening balance, nested deposits and repeated snapshots', () => {
    const cursor = new DepositCursor();
    const old = deposit('old');
    expect(cursor.read({ pollCount: 0, events: [old] })).toBeUndefined();
    expect(cursor.read({ pollCount: 1, events: [old] })).toBeUndefined();
    const fresh = deposit('fresh');
    expect(cursor.read({ pollCount: 2, events: [deposit('child', '0.1'), fresh, old] })).toBe(fresh);
    expect(cursor.read({ pollCount: 3, events: [fresh, old] })).toBeUndefined();
  });

  it('reacts to the first deposit after an empty opening poll', () => {
    const cursor = new DepositCursor();
    expect(cursor.read({ pollCount: 1, events: [] })).toBeUndefined();
    const fresh = deposit('first');
    expect(cursor.read({ pollCount: 2, events: [fresh] })).toBe(fresh);
  });

  it('observes genuine provider deposits without splitting, merging or enabling a cheat', async () => {
    const config: JarConfig = { name: 'Observer test', net: 'sandbox', members: [
      { name: 'A', bps: 5000, address: sampleAddress('observer-a') },
      { name: 'B', bps: 5000, address: sampleAddress('observer-b') },
    ] };
    const provider = await getProvider('sandbox');
    const broadcast = vi.spyOn(provider, 'sendRawTransaction');
    const engine = new JarEngine(config, jarAddress(config), { observeOnly: true });
    try {
      await engine.start();
      await engine.tick();
      engine.setAutoSplit(true);
      engine.armCheat();
      sandboxPay(provider, jarAddress(config), 100_000n);
      sandboxPay(provider, jarAddress(config), 500n);
      sandboxPay(provider, jarAddress(config), 500n);
      await engine.tick();
      expect(engine.getSnapshot().events.filter((e) => e.kind === 'in')).toHaveLength(3);
      expect(engine.getSnapshot().splitCount).toBe(0);
      expect(engine.getSnapshot().autoSplit).toBe(false);
      expect(engine.getSnapshot().cheatArmed).toBe(false);
      expect(broadcast).not.toHaveBeenCalled();
    } finally { engine.stop(); broadcast.mockRestore(); }
  });
});
