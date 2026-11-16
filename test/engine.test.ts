import { describe, expect, it } from 'vitest';
import { JarEngine } from '../src/lib/engine';
import { jarAddress } from '../src/lib/chain';
import { SAMPLE_BAND } from '../src/lib/sample';
import { SPLIT_FEE } from '../src/lib/jar';

const until = async (check: () => boolean, ms = 3000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
};

describe('the watcher', () => {
  it('splits a payment and then the nested jar it paid: one payment, two levels, seven wallets', async () => {
    const engine = new JarEngine(SAMPLE_BAND, jarAddress(SAMPLE_BAND));
    await engine.start();
    await until(() => engine.getSnapshot().status === 'watching');
    engine.simulatePayment(100_000n);
    await until(() => Object.keys(engine.getSnapshot().lastSplits).length === 2);
    engine.stop();
    const snap = engine.getSnapshot();
    const root = snap.lastSplits['0'];
    const crew = snap.lastSplits['0.3'];
    expect(root.amounts).toHaveLength(4);
    expect(crew.amounts).toHaveLength(4);
    // The crew jar split exactly what the band jar paid it, minus its own fee.
    expect(crew.satoshis).toBe(root.amounts![3]);
    const wallets = [...root.amounts!.slice(0, 3), ...crew.amounts!];
    expect(wallets).toHaveLength(7);
    expect(wallets.reduce((a, b) => a + b, 0n)).toBe(100_000n - 2n * SPLIT_FEE);
  });

  it('lets the thief try first, records the refusal and the contract rule, then splits honestly', async () => {
    const engine = new JarEngine(SAMPLE_BAND, jarAddress(SAMPLE_BAND));
    await engine.start();
    await until(() => engine.getSnapshot().status === 'watching');
    engine.armCheat();
    engine.simulatePayment(100_000n);
    await until(() => engine.getSnapshot().events.some((e) => e.kind === 'split' && e.node === '0.3'));
    engine.stop();
    const cheat = engine.getSnapshot().events.find((e) => e.kind === 'cheat');
    expect(cheat?.rule).toBe('one output per member, no extra outputs');
    expect(cheat?.message).toMatch(/OP_VERIFY/);
  });
});
