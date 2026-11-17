// The jar watcher. It polls every jar in the split tree, and the moment a
// payment lands it builds the split transaction and broadcasts it. When a split
// pays a nested jar, the watcher splits that jar too, right away, spending the
// coin it just created. Any device with the jar link can run this; because each
// split is deterministic, every device would broadcast the exact same transactions.
import type { NetworkProvider, SpendableUtxo } from 'cashscript';
import {
  broadcast,
  buildCheat,
  buildDistribute,
  buildMerge,
  errorText,
  explainCheat,
  getProvider,
  isAlreadyKnown,
  isConflict,
  jarTree,
  makeContract,
  sandboxPay,
  type JarNode,
  type AllpaidContract,
  type CheatKind,
} from './chain';
import { lockingBytecodeOf, minPaymentFor, splitPot, type JarConfig } from './jar';
import { binToHex } from '@bitauth/libauth';

export type JarEventKind = 'in' | 'split' | 'merge' | 'cheat' | 'hold' | 'error';

export interface JarEvent {
  id: string;
  kind: JarEventKind;
  at: number;
  /** Which jar in the tree: "0" is the root. */
  node: string;
  jarName: string;
  depth: number;
  satoshis?: bigint;
  txid?: string;
  /** For a split: what each member received, in member order. */
  amounts?: bigint[];
  message?: string;
  /** For a split: how long from seeing the payment to the split being accepted. */
  ms?: number;
  /** The split was broadcast by another device first. */
  byOther?: boolean;
  /** For a refused cheat: which cheat, the contract rule that caught it, its line in Allpaid.cash and that line's code. */
  cheat?: CheatKind;
  rule?: string;
  line?: string;
  code?: string;
}

export type JarStatus = 'connecting' | 'watching' | 'offline';

export interface JarSnapshot {
  pollCount: number;
  status: JarStatus;
  statusMessage?: string;
  address: string;
  events: JarEvent[];
  /** What each member of the root jar received while this page was open. */
  totals: bigint[];
  /** Increments on every split anywhere in the tree; cards use it to light up. */
  splitCount: number;
  /** Last split of the root jar. */
  lastSplit?: JarEvent;
  /** Last split of each jar in the tree, by node id. */
  lastSplits: Record<string, JarEvent>;
  cheatArmed: boolean;
  /** Which cheat the thief will try on the next payment. */
  cheatKind: CheatKind;
  autoSplit: boolean;
  waiting: number;
}

interface LiveNode extends JarNode {
  contract: AllpaidContract;
  min: bigint;
}

const key = (u: SpendableUtxo) => `${u.txid}:${u.vout}`;

export class JarEngine {
  private listeners = new Set<() => void>();
  private snapshot: JarSnapshot;
  private provider?: NetworkProvider;
  private nodes: LiveNode[] = [];
  private seen = new Map<string, number>();
  private handled = new Set<string>();
  private retries = new Map<string, number>();
  private busy = false;
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private failures = 0;
  private lifecycle = 0;
  readonly tree: JarNode[];
  readonly min: bigint;
  readonly pollMs: number;

  constructor(
    readonly config: JarConfig,
    address: string,
    readonly options: { observeOnly?: boolean } = {},
  ) {
    this.tree = jarTree(config);
    this.min = minPaymentFor(config.members);
    this.pollMs = config.net === 'sandbox' ? 250 : 1500;
    this.snapshot = {
      pollCount: 0,
      status: 'connecting',
      address,
      events: [],
      totals: config.members.map(() => 0n),
      splitCount: 0,
      lastSplits: {},
      cheatArmed: false,
      cheatKind: 'all',
      autoSplit: !options.observeOnly,
      waiting: 0,
    };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  private set(patch: Partial<JarSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }

  private push(node: JarNode, event: Omit<JarEvent, 'id' | 'at' | 'node' | 'jarName' | 'depth'>) {
    const full: JarEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: Date.now(),
      node: node.id,
      jarName: node.config.name,
      depth: node.depth,
      ...event,
    };
    const patch: Partial<JarSnapshot> = { events: [full, ...this.snapshot.events].slice(0, 60) };
    if (full.kind === 'split' && full.amounts) {
      patch.splitCount = this.snapshot.splitCount + 1;
      patch.lastSplits = { ...this.snapshot.lastSplits, [node.id]: full };
      if (node.id === '0') {
        patch.totals = this.snapshot.totals.map((t, i) => t + (full.amounts![i] ?? 0n));
        patch.lastSplit = full;
      }
    }
    this.set(patch);
  }

  private async connect() {
    this.provider = await getProvider(this.config.net);
    const provider = this.provider;
    this.nodes = this.tree.map((n) => ({ ...n, contract: makeContract(n.config, provider), min: minPaymentFor(n.config.members) }));
    if (this.nodes[0].contract.address !== this.snapshot.address) throw new Error('Jar address mismatch');
    this.set({ status: 'watching', statusMessage: undefined });
  }

  /** One round, for the keeper: look at every jar in the tree once, split what is waiting, return what happened. */
  async once(): Promise<JarEvent[]> {
    if (this.nodes.length === 0) await this.connect();
    const before = this.snapshot.events.length;
    await this.tick();
    return this.snapshot.events.slice(0, this.snapshot.events.length - before).reverse();
  }

  async start() {
    const lifecycle = ++this.lifecycle;
    this.stopped = false;
    try {
      await this.connect();
      if (this.stopped || lifecycle !== this.lifecycle) return;
      // Coins already in a jar when the page opens are split too (nobody else did it yet).
      await this.loop();
    } catch (error) {
      this.set({ status: 'offline', statusMessage: errorText(error) });
      if (!this.stopped && lifecycle === this.lifecycle) this.timer = setTimeout(() => this.start(), 5000);
    }
  }

  stop() {
    this.lifecycle++;
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  setAutoSplit(on: boolean) {
    if (this.options.observeOnly) return;
    this.set({ autoSplit: on });
    if (on) this.tick();
  }

  /** The next payment into the root jar is first offered to a thief. The network has to refuse it. */
  armCheat(kind: CheatKind = 'all') {
    if (this.options.observeOnly) return;
    this.set({ cheatArmed: true, cheatKind: kind });
  }

  disarmCheat() {
    this.set({ cheatArmed: false });
  }

  /** Sandbox only: a fake payment lands in the in-memory network. */
  simulatePayment(satoshis: bigint) {
    if (!this.provider || this.config.net !== 'sandbox') return;
    sandboxPay(this.provider, this.snapshot.address, satoshis);
    this.tick();
  }

  private loop = async () => {
    if (this.stopped) return;
    await this.tick();
    if (!this.stopped) this.timer = setTimeout(this.loop, this.pollMs);
  };

  async tick() {
    if (this.busy || this.nodes.length === 0) return;
    this.busy = true;
    try {
      let waiting = 0;
      for (const node of this.nodes) {
        const utxos = (await node.contract.getUtxos()).filter((u) => !u.token);
        for (const u of utxos) {
          if (!this.seen.has(key(u))) {
            this.seen.set(key(u), performance.now());
            // Coins a parent split sends to a nested jar are marked seen by that split, so only outside payments show here.
            this.push(node, { kind: 'in', satoshis: u.satoshis, txid: u.txid });
          }
        }
        const open = utxos.filter((u) => !this.handled.has(key(u)));
        waiting += open.length;
        if (!this.snapshot.autoSplit) continue;
        const small: SpendableUtxo[] = [];
        for (const u of open) {
          if (node.depth === 0 && this.snapshot.cheatArmed) await this.tryCheat(node, u);
          if (u.satoshis >= node.min) await this.split(node, u);
          else small.push(u);
        }
        if (small.length >= 2) {
          await this.merge(node, small[0], small[1]);
        } else if (small.length === 1 && !this.handled.has(`hold:${key(small[0])}`)) {
          this.handled.add(`hold:${key(small[0])}`);
          this.push(node, {
            kind: 'hold',
            satoshis: small[0].satoshis,
            message: `Too small to split (the minimum is ${node.min} sats). It waits in the jar for the next small payment.`,
          });
        }
      }
      this.failures = 0;
      if (this.snapshot.status !== 'watching') this.set({ status: 'watching', statusMessage: undefined });
      this.set({ waiting, pollCount: this.snapshot.pollCount + 1 });
    } catch (error) {
      this.failures += 1;
      if (this.failures >= 3) this.set({ status: 'offline', statusMessage: errorText(error) });
    } finally {
      this.busy = false;
    }
  }

  /** Split one payment, then any nested jar it paid. Safe to call from many devices at once. */
  async split(node: LiveNode, utxo: SpendableUtxo) {
    if (this.options.observeOnly || !this.provider || this.handled.has(key(utxo))) return;
    const amounts = splitPot(
      utxo.satoshis,
      node.config.members.map((m) => m.bps),
    );
    const tx = buildDistribute(node.contract, node.config, utxo);
    const seenAt = this.seen.get(key(utxo)) ?? performance.now();
    let ok = false;
    try {
      await broadcast(this.provider, tx);
      this.handled.add(key(utxo));
      this.push(node, { kind: 'split', satoshis: utxo.satoshis, txid: tx.txid, amounts, ms: Math.round(performance.now() - seenAt) });
      ok = true;
    } catch (error) {
      if (isAlreadyKnown(error) || isConflict(error)) {
        // Another device sent the same split first. Same coin, same rules, same txid.
        this.handled.add(key(utxo));
        this.push(node, { kind: 'split', satoshis: utxo.satoshis, txid: tx.txid, amounts, byOther: true });
        ok = true;
      } else {
        // Unknown failure (server hiccup, relay policy). Try again on the next ticks, then give up loudly.
        const tries = (this.retries.get(key(utxo)) ?? 0) + 1;
        this.retries.set(key(utxo), tries);
        if (tries >= 3) {
          this.handled.add(key(utxo));
          this.push(node, { kind: 'error', satoshis: utxo.satoshis, message: `Split failed: ${errorText(error)}` });
        }
      }
    }
    if (!ok) return;
    // Cascade: split each nested jar this transaction just paid, spending the new coin directly.
    for (const child of this.nodes.filter((n) => n.parent === node.id && n.slot !== undefined)) {
      const lock = lockingBytecodeOf(child.address);
      if (typeof lock === 'string') continue;
      const coin: SpendableUtxo = { txid: tx.txid, vout: child.slot!, satoshis: amounts[child.slot!], lockingBytecode: binToHex(lock) };
      if (!this.seen.has(key(coin))) this.seen.set(key(coin), performance.now());
      if (coin.satoshis >= child.min) await this.split(child, coin);
    }
  }

  private async merge(node: LiveNode, a: SpendableUtxo, b: SpendableUtxo) {
    if (!this.provider) return;
    const tx = buildMerge(node.contract, a, b);
    try {
      await broadcast(this.provider, tx);
      this.handled.add(key(a));
      this.handled.add(key(b));
      this.push(node, { kind: 'merge', satoshis: a.satoshis + b.satoshis, txid: tx.txid, message: 'Two small payments joined inside the jar.' });
    } catch (error) {
      this.handled.add(key(a));
      this.handled.add(key(b));
      if (!isAlreadyKnown(error) && !isConflict(error)) {
        this.push(node, { kind: 'error', message: `Merge failed: ${errorText(error)}` });
      }
    }
  }

  private async tryCheat(node: LiveNode, utxo: SpendableUtxo) {
    if (!this.provider) return;
    const kind = this.snapshot.cheatKind;
    this.set({ cheatArmed: false });
    let tx;
    try {
      tx = buildCheat(node.contract, node.config, utxo, kind);
    } catch (error) {
      // Equal amounts: there is nothing to swap. Nothing was sent; say so instead of faking a refusal.
      this.push(node, { kind: 'error', cheat: kind, satoshis: utxo.satoshis, message: `The thief gave up: ${errorText(error)}` });
      return;
    }
    try {
      await broadcast(this.provider, tx);
      // If this ever happens the contract is broken. Say so loudly.
      this.push(node, { kind: 'error', cheat: kind, txid: tx.txid, message: 'The network accepted the cheat. This should be impossible; please report it.' });
    } catch (error) {
      const why = explainCheat(node.contract, node.config, utxo, kind);
      this.push(node, { kind: 'cheat', cheat: kind, satoshis: utxo.satoshis, message: errorText(error), rule: why?.rule, line: why?.line, code: why?.code });
    }
  }
}
