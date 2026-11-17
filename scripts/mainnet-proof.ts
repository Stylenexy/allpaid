#!/usr/bin/env node
// Mainnet proof: two refused spends of one payment, then its fixed split.
// No signing keys are needed. --dry uses only an in-memory network.
//
//   npm run mainnet -- "https://allpaid.vercel.app/jar#<code>" [--timeout 30]
//   npm run mainnet -- --dry
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MockNetworkProvider, Network, type NetworkProvider, type SpendableUtxo } from 'cashscript';
import {
  broadcast, buildCheat, buildDistribute, cheatOutputs, errorText, explainCheat,
  explorerAddress, explorerTx, getProvider, isAlreadyKnown, jarTree, makeContract,
  type CheatKind, type JarNode,
} from '../src/lib/chain';
import { decodeJar, encodeJar, jarCodeFromLink, minPaymentFor, splitPot, validateJar, type JarConfig, type Member } from '../src/lib/jar';
import { sampleAddress } from '../src/lib/sample';
import { SAMPLE_SHAPE, type SampleMember } from '../src/lib/sample-shape';
import { bch } from '../src/lib/format';

const SITE = 'https://allpaid.vercel.app';
const POLL_MS = 5_000;
export const HEADER = '# Mainnet proof\n\n' +
  'This page records a mainnet jar payment, attempted cheats, node responses, and accepted split transactions. ' +
  'The contract fixes each payout and lets anyone trigger the split without a signing key.';

export function parseArgs(args: string[]) {
  let dry = false;
  let timeoutMinutes = 30;
  let input: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry') dry = true;
    else if (arg === '--timeout') {
      const value = args[++i];
      timeoutMinutes = value?.trim() ? Number(value) : NaN;
      if (!Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0 || timeoutMinutes * 60_000 > 2_147_483_647) {
        throw new Error('--timeout must be a positive number of minutes (at most 35791).');
      }
    } else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else if (input) throw new Error('Pass exactly one jar link or bare code.');
    else input = arg;
  }
  if (!dry && !input) throw new Error('Usage: npm run mainnet -- <jar link or code> [--timeout 30], or --dry');
  if (dry && input) throw new Error('--dry uses the sample jar; omit the jar link.');
  return { dry, input, timeoutMs: timeoutMinutes * 60_000 };
}

function validateMainnet(config: JarConfig): JarConfig {
  if (config.net !== 'mainnet') throw new Error(`Mainnet proof requires a mainnet jar; received ${config.net}.`);
  const problems = validateJar(config);
  if (problems.length) throw new Error(problems.map((p) => p.message).join('; '));
  return config;
}

export function mainnetJar(input: string): JarConfig {
  const config = decodeJar(jarCodeFromLink(input) ?? input.trim().replace(/^#/, ''));
  if (!config) throw new Error('Could not decode the jar link or bare code.');
  return validateMainnet(config);
}

/** Public word hashes, with no corresponding signing material. Only used in memory. */
export function dryJar(): JarConfig {
  const member = (m: SampleMember): Member => ({
    name: m.name, bps: m.bps,
    address: m.jar ? '' : sampleAddress(m.name.toLowerCase(), 'bitcoincash'),
    ...(m.jar ? { jar: { name: m.jar.name, members: m.jar.members.map(member) } } : {}),
  });
  return { name: SAMPLE_SHAPE.name, net: 'mainnet', members: SAMPLE_SHAPE.members.map(member) };
}

interface CheatProof {
  kind: CheatKind;
  state: 'broadcasting' | 'refused' | 'skipped' | 'accepted' | 'failed';
  txid?: string;
  message?: string;
  line?: string;
  rule?: string;
  code?: string;
}

interface SplitProof {
  node: string;
  name: string;
  address: string;
  txid: string;
  state: 'broadcasting' | 'accepted' | 'failed';
  message?: string;
  members: { name: string; address: string; amount: bigint }[];
}

export interface MainnetProof {
  at: string;
  jarLink: string;
  address: string;
  payment: { txid: string; vout: number; satoshis: bigint };
  cheats: CheatProof[];
  splits: SplitProof[];
  state: 'running' | 'complete' | 'stopped';
  message?: string;
}

/** A transport, fee-policy, or missing-input error is not evidence of a covenant refusal. */
export function isScriptRefusal(message: string): boolean {
  return /(?:mandatory-script-verify-flag-failed|script (?:failed|verification failed|evaluation failed)|OP_(?:VERIFY|EQUALVERIFY))/i.test(message);
}

export async function runProof(config: JarConfig, provider: NetworkProvider, options: {
  timeoutMs: number;
  log?: (message: string) => void;
  update?: (proof: MainnetProof) => void;
}): Promise<MainnetProof> {
  validateMainnet(config);
  if (provider.network !== Network.MAINNET) throw new Error('The proof provider must use mainnet addresses.');
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) throw new Error('Timeout must be positive.');
  const log = options.log ?? console.log;
  const update = options.update ?? (() => undefined);
  const tree = jarTree(config);
  const root = tree[0];
  const deadline = Date.now() + options.timeoutMs;

  // Bound node requests as well as the polling loop by the run's deadline.
  async function bounded<T>(request: () => Promise<T>): Promise<T> {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Timed out waiting for payment or split acceptance.');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        request(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Timed out waiting for payment or split acceptance.')), remaining);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function waitCoin(node: JarNode, matches: (coin: SpendableUtxo) => boolean): Promise<SpendableUtxo> {
    for (;;) {
      // Observe every jar, but spend only the root payment and its own descendant outputs.
      const coins = await bounded(() => Promise.all(tree.map((n) => provider.getUtxos(n.address))));
      const coin = coins[tree.indexOf(node)].find((u) => !u.token && matches(u));
      if (coin) return coin;
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error(`Timed out waiting for a splittable coin in ${node.config.name}.`);
      await new Promise((r) => setTimeout(r, Math.min(POLL_MS, remaining)));
    }
  }

  for (const node of tree) {
    log(`${node.config.name} (${node.id}): ${node.address}`);
    node.config.members.forEach((m) => log(`  ${m.name}: ${m.bps / 100}% -> ${m.address}`));
    log(`  minimum payment: ${minPaymentFor(node.config.members)} sats (${bch(minPaymentFor(node.config.members))} BCH)`);
  }
  const minimum = minPaymentFor(config.members);
  log(`jar address: ${root.address}`);
  log(`Pay any amount >= ${minimum} sats into this address from your wallet; waiting...`);
  const coin = await waitCoin(root, (u) => u.satoshis >= minimum);
  log(`payment landed: ${coin.txid}:${coin.vout} (${coin.satoshis} sats)`);
  const proof: MainnetProof = {
    at: new Date().toISOString(), jarLink: `${SITE}/jar#${encodeJar(config)}`, address: root.address,
    payment: { txid: coin.txid, vout: coin.vout, satoshis: coin.satoshis },
    cheats: [], splits: [], state: 'running',
  };

  try {
    update(proof);
    const contract = makeContract(root.config, provider);
    for (const kind of ['all', 'swap'] as const) {
      const record: CheatProof = { kind, state: 'broadcasting' };
      proof.cheats.push(record);
      if (kind === 'swap' && (new Set(config.members.map((m) => m.bps)).size === 1 || !cheatOutputs(config, coin, kind))) {
        record.state = 'skipped';
        record.message = 'No unequal shares with different payout amounts to swap; nothing broadcast.';
        log(`cheat "swap" skipped: ${record.message}`);
        update(proof);
        continue;
      }
      const tx = buildCheat(contract, config, coin, kind);
      record.txid = tx.txid;
      update(proof);
      let rejection: unknown;
      let refused = false;
      try {
        // Build and broadcast first. Only replay in the debugger after the node replies.
        await bounded(() => broadcast(provider, tx));
      } catch (error) {
        rejection = error;
        refused = !isAlreadyKnown(error);
      }
      if (!refused) {
        record.state = 'accepted';
        record.message = rejection ? errorText(rejection) : 'The node accepted the transaction.';
        throw new Error(`WARNING: THE NETWORK ACCEPTED CHEAT "${kind}" (${tx.txid}). STOPPED; no further transactions will be sent.`);
      }
      record.message = errorText(rejection);
      record.state = 'failed';
      if (!isScriptRefusal(record.message)) {
        throw new Error(`Cheat "${kind}" did not receive a script refusal: ${record.message}`);
      }
      const why = explainCheat(contract, config, coin, kind);
      record.line = why?.line;
      record.rule = why?.rule;
      record.code = why?.code;
      if (record.line !== (kind === 'all' ? '32' : '39')) throw new Error(`Unexpected contract line for cheat "${kind}": ${record.line ?? 'unknown'}`);
      record.state = 'refused';
      log(`cheat "${kind}" refused (contract line ${record.line}): ${record.message}`);
      update(proof);
    }

    async function split(node: JarNode, input: SpendableUtxo): Promise<void> {
      const amounts = splitPot(input.satoshis, node.config.members.map((m) => m.bps));
      const tx = buildDistribute(makeContract(node.config, provider), node.config, input);
      const record: SplitProof = {
        node: node.id, name: node.config.name, address: node.address, txid: tx.txid, state: 'broadcasting',
        members: node.config.members.map((m, i) => ({ name: m.name, address: m.address, amount: amounts[i] })),
      };
      proof.splits.push(record);
      update(proof);
      try {
        let accepted: string;
        try {
          accepted = await bounded(() => broadcast(provider, tx));
        } catch (error) {
          if (!isAlreadyKnown(error)) throw error;
          accepted = tx.txid;
        }
        if (accepted !== tx.txid) throw new Error(`Node returned an unexpected txid: ${accepted}`);
        record.state = 'accepted';
      } catch (error) {
        record.state = 'failed';
        record.message = errorText(error);
        throw error;
      }
      log(`${node.parent ? 'nested split' : 'honest split'} txid: ${tx.txid} (${amounts.join(' + ')} sats)`);
      update(proof);
      for (const child of tree.filter((n) => n.parent === node.id)) {
        const childCoin = await waitCoin(child, (u) => u.txid === tx.txid && u.vout === child.slot && u.satoshis === amounts[child.slot!]);
        await split(child, childCoin);
      }
    }
    await split(root, coin);
    proof.state = 'complete';
    update(proof);
    return proof;
  } catch (error) {
    proof.state = 'stopped';
    proof.message = errorText(error);
    update(proof);
    throw error;
  }
}

const md = (text: string) => text.replace(/[\\`*_[\]<>|]/g, '\\$&').replace(/[\r\n]+/g, ' ');
const txLink = (txid: string) => `[\`${txid}\`](${explorerTx('mainnet', txid)})`;
const quote = (message: string) => message.split(/\r?\n/).map((line) => `> ${line}`).join('\n');

/** Replace only the current run's snapshot; preserve all earlier runs verbatim. */
export function appendProof(previous: string, proof: MainnetProof): string {
  const pending = previous.replace(/\r\n/g, '\n').trimEnd() === `${HEADER}\n\nRun pending.`;
  const base = pending ? HEADER : previous.trimEnd() || HEADER;
  const cheats = proof.cheats.map((c) =>
    `### Cheat "${c.kind}": ${c.state}\n\n` +
    (c.txid ? `Attempt txid: \`${c.txid}\` (${c.state}).\n\n` : '') +
    (c.message ? `Node response or note:\n\n${quote(c.message)}\n\n` : '') +
    (c.line ? `Debugger replay of the same transaction: \`Allpaid.cash\` line ${c.line}, **${md(c.rule ?? '')}**.\n\n\`\`\`cashscript\n${c.code}\n\`\`\`\n\n` : ''),
  ).join('');
  const splits = proof.splits.map((s) =>
    `### ${s.node === '0' ? 'Honest split' : 'Nested split'}: ${md(s.name)} (${s.node})\n\n` +
    `Transaction: ${txLink(s.txid)}. Status: ${s.state}.\n\n` +
    (s.message ? `${quote(s.message)}\n\n` : '') +
    '| Member | Address | Amount (sats) |\n|---|---|---:|\n' +
    s.members.map((m) => `| ${md(m.name)} | \`${m.address}\` | ${m.amount} |`).join('\n') + '\n\n',
  ).join('');
  return `${base}\n\n## Run ${proof.at}\n\n` +
    `Status: ${proof.state}.\n\nJar link: ${proof.jarLink}\n\n` +
    `Jar address: [\`${proof.address}\`](${explorerAddress('mainnet', proof.address)}).\n\n` +
    `Payment: ${txLink(proof.payment.txid)}, output ${proof.payment.vout}, ${proof.payment.satoshis} sats.\n\n` +
    cheats + splits + (proof.message ? `Run stopped:\n\n${quote(proof.message)}\n\n` : '');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = options.dry ? validateMainnet(dryJar()) : mainnetJar(options.input!);
  const provider = options.dry ? new MockNetworkProvider() : await getProvider('mainnet');
  if (provider instanceof MockNetworkProvider) {
    // Address encoding only: all UTXOs and VM validation remain local to the mock.
    provider.network = Network.MAINNET;
    provider.addUtxo(jarTree(config)[0].address, { txid: '01'.repeat(32), vout: 0, satoshis: 60_000n });
    console.log('DRY RUN (in-memory network; sample addresses must not be funded).');
  }
  try {
    let update: ((proof: MainnetProof) => void) | undefined;
    if (!options.dry) {
      const file = join(process.cwd(), 'docs', 'MAINNET-PROOF.md');
      const previous = existsSync(file) ? readFileSync(file, 'utf8') : '';
      update = (proof) => {
        mkdirSync(join(process.cwd(), 'docs'), { recursive: true });
        writeFileSync(file, appendProof(previous, proof));
      };
    }
    await runProof(config, provider, { timeoutMs: options.timeoutMs, update });
    console.log(options.dry ? 'dry run passed: nothing written' : 'wrote docs/MAINNET-PROOF.md');
  } finally {
    if ('disconnect' in provider && typeof provider.disconnect === 'function') await provider.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    console.error(errorText(error));
    process.exitCode = 1;
  }
}
