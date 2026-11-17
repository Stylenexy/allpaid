#!/usr/bin/env node
// Chipnet proof: the whole Allpaid flow on a real Bitcoin Cash test network, with
// real nodes judging every transaction. Test coins only; it never touches mainnet.
//
//   npm run chipnet -- address      make the test key (once) and show the funding address and balance
//   npm run chipnet -- run          pay, split, nested split, both cheats refused by the node, one keeper round
//   npm run chipnet -- run --dry    the same steps against the in-memory network (no coins needed)
//
// The key lives in .env.chipnet.local (ignored by git and by Vercel). It is a
// random seed; every wallet in the proof jar is derived from it, so the test
// coins only ever move between our own chipnet addresses.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { MockNetworkProvider, SignatureTemplate, TransactionBuilder, randomUtxo, type NetworkProvider, type Utxo } from 'cashscript';
import { binToHex, encodeCashAddress, hash160, hexToBin, secp256k1, sha256, utf8ToBin } from '@bitauth/libauth';
import { JarEngine, type JarEvent } from '../src/lib/engine';
import { explorerAddress, explorerTx, getProvider, jarAddress } from '../src/lib/chain';
import { encodeJar, minPaymentFor, validateJar, type JarConfig, type Net } from '../src/lib/jar';
import { bch } from '../src/lib/format';

const ROOT = process.cwd();
const ENV_FILE = join(ROOT, '.env.chipnet.local');
const SITE = 'https://allpaid.vercel.app';
const PAYMENT = 60_000n;
const NEED = 3n * PAYMENT + 3_000n;

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith('--')) ?? 'address';
const dry = args.includes('--dry');
const net: Net = dry ? 'sandbox' : 'chipnet';

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------
function seed(): Uint8Array {
  if (!existsSync(ENV_FILE)) {
    writeFileSync(
      ENV_FILE,
      `# Allpaid chipnet proof key. Test coins only. Never commit, never reuse on mainnet.\nCHIPNET_SEED=${randomBytes(32).toString('hex')}\n`,
      { encoding: 'utf8', mode: 0o600 },
    );
    console.log('made a new chipnet test key in .env.chipnet.local');
  }
  const hex = /^CHIPNET_SEED=([0-9a-f]{64})$/m.exec(readFileSync(ENV_FILE, 'utf8'))?.[1];
  if (!hex) throw new Error('.env.chipnet.local has no CHIPNET_SEED');
  return hexToBin(hex);
}

interface Key {
  priv: Uint8Array;
  address: string;
}

function key(s: Uint8Array, index: number): Key {
  const priv = sha256.hash(new Uint8Array([...s, ...utf8ToBin(`allpaid chipnet ${index}`)]));
  const pub = secp256k1.derivePublicKeyCompressed(priv);
  if (typeof pub === 'string') throw new Error(pub);
  return { priv, address: encodeCashAddress({ prefix: 'bchtest', type: 'p2pkh', payload: hash160(pub) }).address };
}

// ---------------------------------------------------------------------------
// The proof jar: the sample band shape, every wallet one of our own keys.
// One payment, two levels, seven wallets.
// ---------------------------------------------------------------------------
function proofJar(keys: Key[]): JarConfig {
  return {
    name: 'Allpaid chipnet proof',
    net,
    members: [
      { name: 'Vocals', address: keys[1].address, bps: 3000 },
      { name: 'Drums', address: keys[2].address, bps: 2500 },
      { name: 'Sound', address: keys[3].address, bps: 2000 },
      {
        name: 'Road crew',
        address: '',
        bps: 2500,
        jar: {
          name: 'Road crew',
          members: [
            { name: 'Manager', address: keys[4].address, bps: 4000 },
            { name: 'Stage', address: keys[5].address, bps: 2500 },
            { name: 'Driver', address: keys[6].address, bps: 2000 },
            { name: 'Photos', address: keys[7].address, bps: 1500 },
          ],
        },
      },
    ],
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const balance = (utxos: Utxo[]) => utxos.reduce((sum, u) => sum + u.satoshis, 0n);
const plain = (utxos: Utxo[]) => utxos.filter((u) => !u.token);

/** A plain P2PKH payment from the funding key into the jar, change back to the funding key. */
async function pay(provider: NetworkProvider, from: Key, to: string, amount: bigint): Promise<string> {
  const coins = plain(await provider.getUtxos(from.address)).sort((a, b) => (b.satoshis > a.satoshis ? 1 : -1));
  const signer = new SignatureTemplate(from.priv);
  const build = (fee: bigint) => {
    const builder = new TransactionBuilder({ provider });
    let total = 0n;
    for (const c of coins) {
      builder.addInput(c, signer.unlockP2PKH());
      total += c.satoshis;
      if (total >= amount + fee + 1_000n) break;
    }
    if (total < amount + fee + 1_000n) throw new Error(`not enough test coins at ${from.address}: ${bch(total)} BCH`);
    builder.addOutput({ to, amount });
    builder.addOutput({ to: from.address, amount: total - amount - fee });
    return builder.build();
  };
  // Measure the transaction, then pay 2 sat/byte (relay minimum is 1).
  const hex = build(BigInt(build(1_000n).length / 2) * 2n);
  return provider.sendRawTransaction(hex);
}

async function waitFor(check: () => Promise<boolean>, what: string, ms = 90_000) {
  const start = Date.now();
  while (!(await check())) {
    if (Date.now() - start > ms) throw new Error(`timed out waiting for ${what}`);
    await sleep(dry ? 50 : 2_000);
  }
}

/** Run engine rounds (the keeper's code path) until the root jar and the crew jar have both split again. */
async function roundsUntilSplit(engine: JarEngine, events: JarEvent[], before: number) {
  await waitFor(async () => {
    events.push(...(await engine.once()));
    const splits = engine.getSnapshot().events.filter((e) => e.kind === 'split');
    return splits.filter((e) => e.node === '0').length > before && splits.filter((e) => e.node === '0.3').length > before;
  }, 'the split and the nested split');
}

const link = (txid?: string) => (txid ? (explorerTx(net, txid) ?? txid) : '');

async function address() {
  const s = seed();
  const funder = key(s, 0);
  console.log(`funding address (chipnet): ${funder.address}`);
  console.log(`explorer: ${explorerAddress('chipnet', funder.address)}`);
  try {
    const provider = await getProvider('chipnet');
    const have = balance(plain(await provider.getUtxos(funder.address)));
    console.log(`balance: ${bch(have)} tBCH (the proof needs about ${bch(NEED)})`);
  } catch (error) {
    console.log(`balance: could not reach a chipnet Electrum server (${error instanceof Error ? error.message : String(error)})`);
  }
  process.exit(0);
}

async function run() {
  const s = seed();
  const keys = Array.from({ length: 8 }, (_, i) => key(s, i));
  const funder = keys[0];
  const config = proofJar(keys);
  const problems = validateJar(config);
  if (problems.length > 0) throw new Error(problems.map((p) => p.message).join('; '));
  const jar = jarAddress(config);
  const jarLink = `${SITE}/jar#${encodeJar(config)}`;
  const provider = await getProvider(net);
  if (dry) (provider as MockNetworkProvider).addUtxo(funder.address, randomUtxo({ satoshis: 1_000_000n }));

  const have = balance(plain(await provider.getUtxos(funder.address)));
  console.log(`${dry ? 'DRY RUN (in-memory network). ' : ''}funding ${funder.address}: ${bch(have)} tBCH`);
  if (have < NEED) {
    console.log(`not enough test coins: need ${bch(NEED)} tBCH. Get chipnet coins for ${funder.address}, then run again.`);
    process.exit(2);
  }
  console.log(`jar ${jar} (minimum payment ${minPaymentFor(config.members)} sats)`);

  const engine = new JarEngine(config, jar);
  const events: JarEvent[] = [];
  const steps: { step: string; txid?: string; note?: string }[] = [];

  // 1. Pay, with the thief armed (everything to one member), then the honest split and the nested split.
  engine.armCheat('all');
  const pay1 = await pay(provider, funder, jar, PAYMENT);
  steps.push({ step: `Payment 1 into the jar (${bch(PAYMENT)} tBCH, plain P2PKH wallet transaction)`, txid: pay1 });
  console.log(`paid ${pay1}`);
  await roundsUntilSplit(engine, events, 0);

  // 2. Second payment, the thief swaps two members' amounts.
  engine.armCheat('swap');
  const pay2 = await pay(provider, funder, jar, PAYMENT);
  steps.push({ step: `Payment 2 into the jar (${bch(PAYMENT)} tBCH)`, txid: pay2 });
  console.log(`paid ${pay2}`);
  await roundsUntilSplit(engine, events, 1);

  const cheats = events.filter((e) => e.kind === 'cheat');
  const splits = events.filter((e) => e.kind === 'split');
  const accepted = events.filter((e) => e.kind === 'error' && e.cheat);
  if (accepted.length > 0) throw new Error(`a cheat was not refused: ${accepted[0].message}`);
  for (const [i, e] of splits.entries()) {
    steps.push({
      step: e.node === '0' ? `Split ${Math.floor(i / 2) + 1}: band jar pays 3 wallets + the crew jar (distribute)` : `Split ${Math.floor(i / 2) + 1}: crew jar splits again (nested distribute)`,
      txid: e.txid,
      note: `${e.amounts?.join(' + ')} sats`,
    });
  }

  // 3. Third payment with no page open: one keeper round sends the split.
  const pay3 = await pay(provider, funder, jar, PAYMENT);
  steps.push({ step: `Payment 3 into the jar, then no page open (${bch(PAYMENT)} tBCH)`, txid: pay3 });
  console.log(`paid ${pay3}`);
  await waitFor(async () => (await provider.getUtxos(jar)).some((u) => u.txid === pay3), 'payment 3 in the jar');
  let keeperOut: string;
  const keeperTxids: string[] = [];
  if (dry) {
    // The keeper refuses play-money jars; run its exact round (a fresh engine, once()) in process instead.
    const round = await new JarEngine(config, jar).once();
    keeperOut = round.map((e) => `${e.jarName}: ${e.kind}${e.txid ? ` ${e.txid}` : ''}`).join('\n');
    keeperTxids.push(...round.filter((e) => e.kind === 'split').map((e) => e.txid!));
  } else {
    const result = spawnSync(`npm run keeper -- "${jarLink}"`, { cwd: ROOT, shell: true, encoding: 'utf8' });
    keeperOut = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    if (result.status !== 0) throw new Error(`keeper failed:\n${keeperOut}`);
    for (const m of keeperOut.matchAll(/: split [^\n]*?\/tx\/([0-9a-f]{64})/g)) keeperTxids.push(m[1]);
  }
  if (keeperTxids.length < 2) throw new Error(`the keeper round did not send both splits:\n${keeperOut}`);
  steps.push({ step: 'Keeper round: band jar split', txid: keeperTxids[0] });
  steps.push({ step: 'Keeper round: crew jar split', txid: keeperTxids[1] });

  // Where the money ended up: seven wallets, all ours.
  const wallets = await Promise.all(keys.slice(1).map(async (k) => balance(await provider.getUtxos(k.address))));
  const received = wallets.reduce((a, b) => a + b, 0n);
  console.log(`seven wallets hold ${received} sats (3 payments of ${PAYMENT} minus 6 split fees = ${3n * PAYMENT - 6_000n})`);

  const proof = { net, at: new Date().toISOString(), jar, jarLink, funder: funder.address, steps, cheats, keeperOut, received: String(received) };
  console.log(JSON.stringify(proof, (_k, v) => (typeof v === 'bigint' ? String(v) : v), 2));
  if (dry) {
    console.log('dry run passed: nothing written');
    process.exit(0);
  }

  mkdirSync(join(ROOT, 'docs'), { recursive: true });
  writeFileSync(join(ROOT, 'docs', 'chipnet-proof.json'), `${JSON.stringify(proof, (_k, v) => (typeof v === 'bigint' ? String(v) : v), 2)}\n`);
  writeFileSync(join(ROOT, 'docs', 'CHIPNET-PROOF.md'), report(proof));
  console.log('wrote docs/CHIPNET-PROOF.md and docs/chipnet-proof.json');
  process.exit(0);
}

function report(p: { at: string; jar: string; jarLink: string; funder: string; steps: { step: string; txid?: string; note?: string }[]; cheats: JarEvent[]; keeperOut: string; received: string }): string {
  const rows = p.steps.map((s) => `| ${s.step} | ${s.txid ? `[\`${s.txid.slice(0, 16)}…\`](${link(s.txid)})` : ''} | ${s.note ?? ''} |`).join('\n');
  const cheats = p.cheats
    .map(
      (c) =>
        `### ${c.cheat === 'swap' ? "Cheat 2: swap two members' amounts" : 'Cheat 1: everything to one member'}\n\n` +
        `The node said:\n\n\`\`\`\n${c.message}\n\`\`\`\n\n` +
        `The rule that caught it, \`Allpaid.cash\` line ${c.line}: **${c.rule}**\n\n\`\`\`\n${c.code ?? ''}\n\`\`\`\n`,
    )
    .join('\n');
  return `# Chipnet proof

Run on ${p.at.slice(0, 10)} (UTC) with \`npm run chipnet -- run\` ([\`scripts/chipnet-proof.ts\`](../scripts/chipnet-proof.ts)). Chipnet is a public Bitcoin Cash test network: real nodes, test coins. Every transaction below was judged by chipnet nodes through an Electrum server, not by the app.

- Jar: [\`${p.jar}\`](${explorerAddress('chipnet', p.jar)}), the sample band shape (three wallets and a crew jar of four): one payment, two levels, seven wallets.
- Jar link: ${p.jarLink}
- All seven wallets and the payer are keys made for this run; the coins only moved between them.

## Transactions

| Step | Transaction | Amounts |
|---|---|---|
${rows}

The seven wallets received ${p.received} sats in total: three payments of ${PAYMENT} sats minus six split fees of 1,000 sats.

## Both cheats, refused by a chipnet node

Before each honest split the thief broadcast its own spend of the same coin, straight to the node with no local check.

${cheats}
## Keeper round (no page open)

\`npm run keeper -- "<jar link>"\` printed:

\`\`\`
${p.keeperOut}
\`\`\`
`;
}

try {
  if (command === 'run') await run();
  else await address();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
