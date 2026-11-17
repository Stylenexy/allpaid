#!/usr/bin/env node
// allpaid-keeper: sends the split for payments waiting in one or more jars,
// so members get paid even when nobody has the jar page open.
//
// It holds no keys and needs none: a split is a covenant spend whose fee comes
// out of the payment, and it can only pay the members, in their shares.
//
//   allpaid-keeper <jar link or code>...          one round, then exit
//   allpaid-keeper --file keeper/jars.txt          jars listed one per line (# comments)
//   allpaid-keeper --watch [--every 30] <jar>...   keep going, a round every 30 s
import { readFileSync } from 'node:fs';
import { JarEngine } from '../src/lib/engine';
import { jarAddress, explorerTx } from '../src/lib/chain';
import { decodeJar, jarCodeFromLink, validateJar } from '../src/lib/jar';
import { bch } from '../src/lib/format';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (flag('--help') || flag('-h') || args.length === 0) {
  console.log(`allpaid-keeper: split payments waiting in Allpaid jars.

  allpaid-keeper <jar link or code>...
  allpaid-keeper --file jars.txt
  allpaid-keeper --watch [--every 30] <jar link or code>...`);
  process.exit(args.length === 0 ? 1 : 0);
}

const inputs: string[] = [];
const file = option('--file');
if (file) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (t && !t.startsWith('#')) inputs.push(t);
  }
}
const skip = new Set(['--file', '--every'].flatMap((o) => (option(o) ? [option(o)!] : [])));
for (const a of args) if (!a.startsWith('--') && !skip.has(a)) inputs.push(a);

const engines = inputs.flatMap((input) => {
  const code = jarCodeFromLink(input) ?? input.replace(/^#/, '');
  const config = decodeJar(code);
  if (!config) {
    console.error(`skip: not a jar link: ${input.slice(0, 60)}`);
    return [];
  }
  const problems = validateJar(config);
  if (problems.length > 0 || config.net === 'sandbox') {
    console.error(`skip: ${config.name}: ${problems[0]?.message ?? 'play-money jars live only in a browser tab'}`);
    return [];
  }
  return [new JarEngine(config, jarAddress(config))];
});

if (engines.length === 0) {
  console.log('no jars to keep');
  process.exit(0);
}

async function round() {
  for (const engine of engines) {
    try {
      const events = await engine.once();
      const waiting = engine.getSnapshot().waiting;
      if (events.length === 0) console.log(`${engine.config.name}: nothing waiting`);
      for (const e of events) {
        const amount = e.satoshis !== undefined ? ` ${bch(e.satoshis)} BCH` : '';
        const link = e.txid ? ` ${explorerTx(engine.config.net, e.txid) ?? e.txid}` : '';
        console.log(`${e.jarName}: ${e.kind}${amount}${link}${e.message && e.kind !== 'split' ? ` (${e.message})` : ''}`);
      }
      if (waiting > 0 && events.every((e) => e.kind !== 'split')) console.log(`${engine.config.name}: ${waiting} coin(s) still waiting`);
    } catch (error) {
      console.error(`${engine.config.name}: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }
}

if (flag('--watch')) {
  const every = Math.max(5, Number(option('--every') ?? 30)) * 1000;
  for (;;) {
    await round();
    await new Promise((r) => setTimeout(r, every));
  }
} else {
  await round();
  process.exit();
}
