import { describe, expect, it, beforeEach } from 'vitest';
import { MockNetworkProvider, TransactionBuilder, randomUtxo, type SpendableUtxo } from 'cashscript';
import 'cashscript/dist/test/VitestExtensions.js';
import { buildCheat, buildDistribute, buildMerge, explainCheat, makeContract, outputsOf, type KenclengContract } from '../src/lib/chain';
import { splitPot, minPayment, SPLIT_FEE, type JarConfig, lockingBytecodeOf } from '../src/lib/jar';
import { sampleAddress } from '../src/lib/sample';
import { binToHex } from '@bitauth/libauth';

const jar = (bps: number[]): JarConfig => ({
  name: 'Test band',
  net: 'sandbox',
  members: bps.map((b, i) => ({ name: `m${i}`, address: sampleAddress(`member-${i}`), bps: b })),
});
const thief = sampleAddress('thief');
const lockHex = (address: string) => binToHex(lockingBytecodeOf(address) as Uint8Array);

let provider: MockNetworkProvider;
beforeEach(() => {
  provider = new MockNetworkProvider();
});

function fund(contract: KenclengContract, satoshis: bigint): SpendableUtxo {
  return provider.addUtxo(contract.address, randomUtxo({ satoshis }));
}

describe('honest split', () => {
  for (const bps of [[6000, 4000], [5000, 3000, 2000], [4000, 3000, 2000, 1000]]) {
    it(`pays ${bps.length} members their exact shares and nothing else`, async () => {
      const config = jar(bps);
      const contract = makeContract(config, provider);
      const utxo = fund(contract, 100_000n);
      const tx = buildDistribute(contract, config, utxo);
      await provider.sendRawTransaction(tx.hex);

      const outs = outputsOf(tx.hex);
      const expected = splitPot(100_000n, bps);
      expect(outs.map((o) => o.satoshis)).toEqual(expected);
      expect(outs.map((o) => o.lockingBytecode)).toEqual(config.members.map((m) => lockHex(m.address)));
      // The fee is exactly the contract's fixed fee, and pays at least 1 sat per byte.
      const paidOut = outs.reduce((sum, o) => sum + o.satoshis, 0n);
      expect(100_000n - paidOut).toBe(SPLIT_FEE);
      expect(tx.bytes).toBeLessThanOrEqual(Number(SPLIT_FEE));
      // The jar is empty afterwards, and each member now holds a coin.
      expect(await provider.getUtxos(contract.address)).toHaveLength(0);
      for (const [i, m] of config.members.entries()) {
        const coins = await provider.getUtxos(m.address);
        expect(coins.map((c) => c.satoshis)).toEqual([expected[i]]);
      }
    });
  }

  it('sends rounding dust to the last member, so no satoshi is lost', async () => {
    const bps = [3333, 3333, 3334];
    const config = jar(bps);
    const contract = makeContract(config, provider);
    const payment = 123_457n;
    const tx = buildDistribute(contract, config, fund(contract, payment));
    await provider.sendRawTransaction(tx.hex);
    const amounts = outputsOf(tx.hex).map((o) => o.satoshis);
    // pot = 122,457: 33.33% floors to 40,814 (40,814.9...), the last member takes the rest.
    expect(amounts).toEqual([40_814n, 40_814n, 40_829n]);
    expect(amounts.reduce((a, b) => a + b, 0n)).toBe(payment - SPLIT_FEE);
  });

  it('builds the same split, with the same txid, on every device', () => {
    const config = jar([5000, 3000, 2000]);
    const contract = makeContract(config, provider);
    const utxo = fund(contract, 250_000n);
    const a = buildDistribute(contract, config, utxo);
    const b = buildDistribute(makeContract(config, new MockNetworkProvider()), config, utxo);
    expect(a.txid).toBe(b.txid);
    expect(a.hex).toBe(b.hex);
  });

  it('gives every set of shares its own address', () => {
    const a = makeContract(jar([5000, 3000, 2000]), provider).address;
    const b = makeContract(jar([5000, 2000, 3000]), provider).address;
    const c = makeContract(jar([5000, 3000, 2000]), provider).address;
    expect(a).not.toBe(b);
    expect(a).toBe(c);
  });
});

describe('the contract refuses to be cheated', () => {
  const config = jar([5000, 3000, 2000]);

  it('refuses to send the whole pot to one member, and the network rejects it too', async () => {
    const contract = makeContract(config, provider);
    const utxo = fund(contract, 100_000n);
    const cheat = buildCheat(contract, config, utxo);
    await expect(provider.sendRawTransaction(cheat.hex)).rejects.toThrow();
    // The coin is still in the jar after the failed attempt.
    expect(await provider.getUtxos(contract.address)).toHaveLength(1);

    const builder = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.distribute())
      .addOutput({ to: config.members[0].address, amount: 99_000n });
    expect(builder).toFailRequireWith(/one output per member/);
    // The page names the contract rule that refused it.
    expect(explainCheat(contract, config, utxo)).toEqual({ rule: 'one output per member, no extra outputs', line: '32' });
  });

  it('refuses an output redirected to someone else, even with the right amount', () => {
    const contract = makeContract(config, provider);
    const utxo = fund(contract, 100_000n);
    const [a, b, c] = splitPot(100_000n, [5000, 3000, 2000]);
    const builder = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.distribute())
      .addOutput({ to: config.members[0].address, amount: a })
      .addOutput({ to: thief, amount: b })
      .addOutput({ to: config.members[2].address, amount: c });
    expect(builder).toFailRequireWith(/output 1 must pay member 2/);
  });

  it('refuses swapped amounts between members', () => {
    const contract = makeContract(config, provider);
    const utxo = fund(contract, 100_000n);
    const [a, b, c] = splitPot(100_000n, [5000, 3000, 2000]);
    const builder = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.distribute())
      .addOutput({ to: config.members[0].address, amount: b })
      .addOutput({ to: config.members[1].address, amount: a })
      .addOutput({ to: config.members[2].address, amount: c });
    expect(builder).toFailRequireWith(/output 0 has the wrong amount/);
  });

  it('refuses a bigger fee (a miner or trigger skimming the pot)', async () => {
    const contract = makeContract(config, provider);
    const utxo = fund(contract, 100_000n);
    // Each member gets 500 sats less; the missing 1,500 would go to the miner.
    const shares = splitPot(100_000n, [5000, 3000, 2000]).map((s) => s - 500n);
    const builder = new TransactionBuilder({ provider }).addInput(utxo, contract.unlock.distribute());
    config.members.forEach((m, i) => builder.addOutput({ to: m.address, amount: shares[i] }));
    expect(builder).toFailRequireWith(/output 0 has the wrong amount/);
    await expect(provider.sendRawTransaction(builder.build())).rejects.toThrow();
  });

  it('refuses an extra output tacked on the end', () => {
    const contract = makeContract(config, provider);
    const utxo = fund(contract, 100_000n);
    const shares = splitPot(100_000n, [5000, 3000, 2000]);
    const builder = new TransactionBuilder({ provider }).addInput(utxo, contract.unlock.distribute());
    config.members.forEach((m, i) => builder.addOutput({ to: m.address, amount: shares[i] - 500n }));
    builder.addOutput({ to: thief, amount: 1000n });
    expect(builder).toFailRequireWith(/one output per member/);
  });

  it('refuses to split two payments in one transaction', () => {
    const contract = makeContract(config, provider);
    const one = fund(contract, 100_000n);
    const two = fund(contract, 100_000n);
    const shares = splitPot(200_000n, [5000, 3000, 2000]);
    const builder = new TransactionBuilder({ provider })
      .addInput(one, contract.unlock.distribute())
      .addInput(two, contract.unlock.distribute());
    config.members.forEach((m, i) => builder.addOutput({ to: m.address, amount: shares[i] }));
    expect(builder).toFailRequireWith(/split one payment at a time/);
  });
});

describe('small payments', () => {
  const bps = [5000, 3000, 2000];
  const config = jar(bps);

  it('knows the smallest payment it can split', () => {
    const min = minPayment(bps);
    expect(splitPot(min, bps).every((s) => s >= 1000n)).toBe(true);
    expect(splitPot(min - 1n, bps).some((s) => s < 1000n)).toBe(true);
    // pot 4,995 -> 2,497 + 1,498 + 1,000; one satoshi less leaves the last member 999.
    expect(min).toBe(5995n);
    for (let p = min; p < min + 3000n; p += 1n) expect(splitPot(p, bps).every((s) => s >= 1000n)).toBe(true);
  });

  it('refuses to create a payout under 1,000 sats', () => {
    const contract = makeContract(config, provider);
    const utxo = fund(contract, 5_000n);
    const shares = splitPot(5_000n, bps);
    const builder = new TransactionBuilder({ provider }).addInput(utxo, contract.unlock.distribute());
    config.members.forEach((m, i) => builder.addOutput({ to: m.address, amount: shares[i] }));
    expect(builder).toFailRequireWith(/share below 1000 sats/);
  });

  it('merges two small payments inside the jar, then splits them', async () => {
    const contract = makeContract(config, provider);
    const a = fund(contract, 4_000n);
    const b = fund(contract, 4_500n);
    const merge = buildMerge(contract, a, b);
    await provider.sendRawTransaction(merge.hex);
    const [merged] = await provider.getUtxos(contract.address);
    expect(merged.satoshis).toBe(4_000n + 4_500n - SPLIT_FEE);

    const split = buildDistribute(contract, config, merged);
    await provider.sendRawTransaction(split.hex);
    expect(outputsOf(split.hex).map((o) => o.satoshis)).toEqual(splitPot(7_500n, bps));
  });

  it('refuses a merge that sends the coins out of the jar', () => {
    const contract = makeContract(config, provider);
    const a = fund(contract, 4_000n);
    const b = fund(contract, 4_500n);
    const builder = new TransactionBuilder({ provider })
      .addInput(a, contract.unlock.merge())
      .addInput(b, contract.unlock.merge())
      .addOutput({ to: thief, amount: 7_500n });
    expect(builder).toFailRequireWith(/the merged coin stays in the jar/);
  });

  it('refuses a merge that skims more than the fee', () => {
    const contract = makeContract(config, provider);
    const a = fund(contract, 4_000n);
    const b = fund(contract, 4_500n);
    const builder = new TransactionBuilder({ provider })
      .addInput(a, contract.unlock.merge())
      .addInput(b, contract.unlock.merge())
      .addOutput({ to: contract.address, amount: 6_000n });
    expect(builder).toFailRequireWith(/merged amount must be the sum minus the fee/);
  });
});
