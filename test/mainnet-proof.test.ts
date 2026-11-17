import { afterEach, describe, expect, it, vi } from 'vitest';
import { MockNetworkProvider, Network } from 'cashscript';
import { buildCheat, jarAddress, jarTree, makeContract, outputsOf } from '../src/lib/chain';
import { encodeJar, minPaymentFor, validateJar, type JarConfig } from '../src/lib/jar';
import { sampleAddress } from '../src/lib/sample';
import { appendProof, dryJar, HEADER, isScriptRefusal, mainnetJar, parseArgs, runProof, type MainnetProof } from '../scripts/mainnet-proof';

const paymentId = 'ab'.repeat(32);
function setup(config = dryJar(), satoshis = 60_000n) {
  const provider = new MockNetworkProvider();
  provider.network = Network.MAINNET;
  const coin = provider.addUtxo(jarAddress(config), { txid: paymentId, vout: 1, satoshis });
  const log = vi.fn();
  const update = vi.fn();
  const send = vi.spyOn(provider, 'sendRawTransaction');
  return { config, provider, coin, log, update, send, options: { timeoutMs: 60_000, log, update } };
}

afterEach(() => vi.useRealTimers());

describe('mainnet proof input', () => {
  it('accepts a mainnet link or bare code, validates it, and defaults to 30 minutes', () => {
    const config = dryJar();
    const code = encodeJar(config);
    expect(validateJar(config)).toEqual([]);
    expect(mainnetJar(code)).toEqual(config);
    expect(mainnetJar(`https://allpaid.vercel.app/jar#${code}`)).toEqual(config);
    expect(parseArgs([code])).toEqual({ dry: false, input: code, timeoutMs: 1_800_000 });
    expect(parseArgs(['--timeout', '0.5', code]).timeoutMs).toBe(30_000);
    expect(parseArgs(['--dry']).dry).toBe(true);
  });

  it('rejects chipnet, sandbox, invalid configurations and invalid command arguments', () => {
    for (const net of ['chipnet', 'sandbox'] as const) {
      expect(() => mainnetJar(encodeJar({ ...dryJar(), net }))).toThrow(`received ${net}`);
    }
    const invalid = dryJar();
    invalid.members[0].bps = 1;
    expect(() => mainnetJar(encodeJar(invalid))).toThrow('at least 1%');
    expect(() => mainnetJar('not-a-jar')).toThrow('Could not decode');
    for (const args of [[], ['--wat'], ['a', 'b'], ['--timeout'], ['--dry', 'a']]) {
      expect(() => parseArgs(args)).toThrow();
    }
    for (const value of ['0', '-1', 'NaN', 'Infinity', '1e100', '']) {
      expect(() => parseArgs(['--dry', '--timeout', value])).toThrow('--timeout');
    }
  });
});

describe('mainnet proof on an in-memory network', () => {
  it('broadcasts both cheats against the same coin before the root and nested honest splits', async () => {
    const f = setup();
    const proof = await runProof(f.config, f.provider, f.options);
    expect(proof.state).toBe('complete');
    expect(proof.payment).toEqual({ txid: paymentId, vout: 1, satoshis: 60_000n });
    expect(proof.cheats.map((c) => [c.kind, c.state, c.line])).toEqual([
      ['all', 'refused', '32'], ['swap', 'refused', '39'],
    ]);
    expect(proof.cheats.every((c) => c.message?.includes('OP_VERIFY'))).toBe(true);
    const contract = makeContract(f.config, f.provider);
    expect(f.send.mock.calls.slice(0, 2).map(([hex]) => hex)).toEqual([
      buildCheat(contract, f.config, f.coin, 'all').hex,
      buildCheat(contract, f.config, f.coin, 'swap').hex,
    ]);
    expect(f.send).toHaveBeenCalledTimes(4);
    expect(proof.splits.map((s) => [s.node, s.state])).toEqual([['0', 'accepted'], ['0.3', 'accepted']]);
    for (const [i, split] of proof.splits.entries()) {
      expect(outputsOf(f.send.mock.calls[i + 2][0]).map((o) => o.satoshis)).toEqual(split.members.map((m) => m.amount));
      expect(await f.provider.getUtxos(split.address)).toEqual([]);
    }
    const leaves = [...proof.splits[0].members.slice(0, 3), ...proof.splits[1].members];
    expect(leaves.reduce((sum, m) => sum + m.amount, 0n)).toBe(58_000n);
    for (const member of leaves) {
      expect((await f.provider.getUtxos(member.address))[0].satoshis).toBe(member.amount);
    }
    expect(f.log.mock.calls.flat().join('\n')).toMatch(/payment landed:.*\ncheat "all" refused \(contract line 32\).*\ncheat "swap" refused \(contract line 39\).*\nhonest split txid:.*\nnested split txid:/s);
  });

  it('polls every five seconds, ignoring tokens, small payments and unrelated nested coins', async () => {
    vi.useFakeTimers();
    const f = setup(dryJar(), minPaymentFor(dryJar().members) - 1n);
    const tree = jarTree(f.config);
    f.provider.addUtxo(tree[0].address, {
      txid: 'cd'.repeat(32), vout: 0, satoshis: 100_000n,
      token: { category: 'ef'.repeat(32), amount: 1n },
    });
    f.provider.addUtxo(tree[1].address, { txid: '11'.repeat(32), vout: 0, satoshis: 50_000n });
    const reads = vi.spyOn(f.provider, 'getUtxos');
    const running = runProof(f.config, f.provider, f.options);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(reads.mock.calls.map(([address]) => address)).toEqual(tree.map((n) => n.address));
    expect(f.send).not.toHaveBeenCalled();
    f.provider.addUtxo(tree[0].address, { txid: '22'.repeat(32), vout: 0, satoshis: 60_000n });
    await vi.advanceTimersByTimeAsync(1);
    const proof = await running;
    expect(proof.payment.txid).toBe('22'.repeat(32));
    expect((await f.provider.getUtxos(tree[0].address)).map((u) => u.txid)).toEqual([paymentId, 'cd'.repeat(32)]);
    expect((await f.provider.getUtxos(tree[1].address)).map((u) => u.txid)).toEqual(['11'.repeat(32)]);
  });

  it('times out on both missing payments and unresponsive node requests without broadcasting', async () => {
    vi.useFakeTimers();
    for (const unresponsive of [false, true]) {
      const f = setup(dryJar(), 1n);
      if (unresponsive) vi.spyOn(f.provider, 'getUtxos').mockImplementation(() => new Promise(() => undefined));
      const result = runProof(f.config, f.provider, { ...f.options, timeoutMs: 10_000 }).catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(10_000);
      expect((await result as Error).message).toMatch(/Timed out/);
      expect(f.send).not.toHaveBeenCalled();
    }
  });

  it('stops immediately if either cheat is accepted or already known', async () => {
    for (const attempt of [1, 2]) {
      for (const alreadyKnown of [false, true]) {
        const f = setup();
        const original = (hex: string) => MockNetworkProvider.prototype.sendRawTransaction.call(f.provider, hex);
        let calls = 0;
        f.send.mockImplementation(async (hex) => {
          calls++;
          if (calls === attempt) {
            if (alreadyKnown) throw new Error('txn-already-in-mempool');
            f.provider.options.validateTransactions = false;
          }
          return original(hex);
        });
        await expect(runProof(f.config, f.provider, f.options)).rejects.toThrow('WARNING: THE NETWORK ACCEPTED CHEAT');
        expect(f.send).toHaveBeenCalledTimes(attempt);
        const proof = f.update.mock.lastCall![0] as MainnetProof;
        expect(proof.state).toBe('stopped');
        expect(proof.cheats.at(-1)?.state).toBe('accepted');
        expect(proof.splits).toEqual([]);
      }
    }
  });

  it('does not turn connectivity, fee-policy or spent-input errors into covenant evidence', async () => {
    for (const message of ['Electrum socket disconnected', 'min relay fee not met', 'bad-txns-inputs-missingorspent']) {
      const f = setup();
      f.send.mockRejectedValue(new Error(message));
      await expect(runProof(f.config, f.provider, f.options)).rejects.toThrow('did not receive a script refusal');
      expect(f.send).toHaveBeenCalledTimes(1);
      const proof = f.update.mock.lastCall![0] as MainnetProof;
      expect(proof.cheats[0]).toMatchObject({ state: 'failed', message });
      expect(proof.cheats[0].line).toBeUndefined();
      expect(proof.splits).toEqual([]);
    }
    expect(isScriptRefusal('mandatory-script-verify-flag-failed (Script failed an OP_VERIFY operation)')).toBe(true);
  });

  it('skips swap when shares are equal or differing shares produce equal amounts', async () => {
    for (const shares of [[5000, 5000], [5001, 4999]]) {
      const config: JarConfig = { ...dryJar(), members: dryJar().members.slice(0, 2).map((m, i) => ({ ...m, bps: shares[i] })) };
      const f = setup(config, 10_000n);
      const proof = await runProof(config, f.provider, f.options);
      expect(proof.cheats[1]).toMatchObject({ kind: 'swap', state: 'skipped' });
      expect(proof.cheats[1].txid).toBeUndefined();
      expect(f.send).toHaveBeenCalledTimes(2);
      expect(proof.splits[0].state).toBe('accepted');
    }
  });

  it('records failed honest broadcasts and never treats a conflict as acceptance', async () => {
    const f = setup();
    const send = (hex: string) => MockNetworkProvider.prototype.sendRawTransaction.call(f.provider, hex);
    let calls = 0;
    f.send.mockImplementation((hex) => ++calls === 3 ? Promise.reject(new Error('txn-mempool-conflict')) : send(hex));
    await expect(runProof(f.config, f.provider, f.options)).rejects.toThrow('txn-mempool-conflict');
    expect(f.send).toHaveBeenCalledTimes(3);
    const proof = f.update.mock.lastCall![0] as MainnetProof;
    expect(proof.state).toBe('stopped');
    expect(proof.splits).toHaveLength(1);
    expect(proof.splits[0]).toMatchObject({ state: 'failed', message: 'txn-mempool-conflict' });
    expect(appendProof('', proof)).toContain(proof.splits[0].txid);
  });

  it('cascades into all three supported levels', async () => {
    const config = dryJar();
    config.members[3].jar!.members[0] = {
      name: 'Management', address: '', bps: 4000,
      jar: { name: 'Management', members: [
        { name: 'Manager A', address: sampleAddress('manager-a', 'bitcoincash'), bps: 6000 },
        { name: 'Manager B', address: sampleAddress('manager-b', 'bitcoincash'), bps: 4000 },
      ] },
    };
    const f = setup(config, minPaymentFor(config.members));
    const proof = await runProof(config, f.provider, f.options);
    expect(proof.splits.map((s) => s.node)).toEqual(['0', '0.3', '0.3.0']);
    expect(proof.splits.every((s) => s.state === 'accepted')).toBe(true);
  });
});

describe('mainnet proof markdown', () => {
  it('replaces the pending marker, preserves earlier runs, and includes all txids, node text, lines and member amounts', async () => {
    const f = setup();
    f.config.members[0].name = 'A | B\n<crew>';
    const proof = await runProof(f.config, f.provider, f.options);
    const report = appendProof(`${HEADER}\n\nRun pending.\n`, proof);
    expect(report).not.toContain('Run pending.');
    expect(appendProof(`${HEADER}\n\nRun pending.\n`.replace(/\n/g, '\r\n'), proof)).not.toContain('Run pending.');
    expect(report).toContain(proof.at);
    expect(report).toContain(proof.jarLink);
    expect(report).toContain(`/address/${proof.address.replace('bitcoincash:', '')}`);
    expect(report).toContain(`/transaction/${paymentId}`);
    for (const cheat of proof.cheats) {
      expect(report).toContain(cheat.txid);
      expect(report).toContain(cheat.message);
      expect(report).toContain(`line ${cheat.line}`);
    }
    for (const split of proof.splits) {
      expect(report).toContain(`/transaction/${split.txid}`);
      for (const m of split.members) expect(report).toContain(`\`${m.address}\` | ${m.amount} |`);
    }
    expect(report).toContain('A \\| B \\<crew\\>');
    expect(appendProof(report, proof).startsWith(report.trimEnd() + '\n\n## Run')).toBe(true);
    expect((report.match(/^# Mainnet proof$/gm) ?? [])).toHaveLength(1);
  });
});
