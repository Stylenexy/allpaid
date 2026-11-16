// The jar watcher. It polls the jar address, and the moment a payment lands it
// builds the split transaction and broadcasts it. Any device with the jar link
// can run this; because the split is deterministic, every device would
// broadcast the exact same transaction.
import type { NetworkProvider, SpendableUtxo } from 'cashscript';
import {
  broadcast,
  buildCheat,
  buildDistribute,
  buildMerge,
  errorText,
  getProvider,
  isAlreadyKnown,
  isConflict,
  makeContract,
  sandboxPay,
  type KenclengContract,
} from './chain';
import { minPayment, splitPot, type JarConfig } from './jar';

export type JarEventKind = 'in' | 'split' | 'merge' | 'cheat' | 'hold' | 'error';

export interface JarEvent {
  id: string;
  kind: JarEventKind;
  at: number;
  satoshis?: bigint;
  txid?: string;
  /** For a split: what each member received, in member order. */
  amounts?: bigint[];
  message?: string;
  /** For a split: how long from seeing the payment to the split being accepted. */
  ms?: number;
  /** The split was broadcast by another device first. */
  byOther?: boolean;
}

export type JarStatus = 'connecting' | 'watching' | 'offline';

export interface JarSnapshot {
  status: JarStatus;
  statusMessage?: string;
  address: string;
  events: JarEvent[];
  /** What each member received while this page was open. */
  totals: bigint[];
  /** Increments on every split; the member cards use it to light up. */
  splitCount: number;
  lastSplit?: JarEvent;
  cheatArmed: boolean;
  autoSplit: boolean;
  waiting: number;
}

const key = (u: SpendableUtxo) => `${u.txid}:${u.vout}`;

export class JarEngine {
  private listeners = new Set<() => void>();
  private snapshot: JarSnapshot;
  private provider?: NetworkProvider;
  private contract?: KenclengContract;
  private seen = new Map<string, number>();
  private handled = new Set<string>();
  private retries = new Map<string, number>();
  private busy = false;
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private failures = 0;
  readonly min: bigint;
  readonly pollMs: number;

  constructor(readonly config: JarConfig, address: string) {
    this.min = minPayment(config.members.map((m) => m.bps));
    this.pollMs = config.net === 'sandbox' ? 250 : 1500;
    this.snapshot = {
      status: 'connecting',
      address,
      events: [],
      totals: config.members.map(() => 0n),
      splitCount: 0,
      cheatArmed: false,
      autoSplit: true,
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

  private push(event: Omit<JarEvent, 'id' | 'at'>) {
    const full: JarEvent = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), ...event };
    const patch: Partial<JarSnapshot> = { events: [full, ...this.snapshot.events].slice(0, 40) };
    if (full.kind === 'split' && full.amounts) {
      patch.totals = this.snapshot.totals.map((t, i) => t + (full.amounts![i] ?? 0n));
      patch.splitCount = this.snapshot.splitCount + 1;
      patch.lastSplit = full;
    }
    this.set(patch);
  }

  async start() {
    try {
      this.provider = await getProvider(this.config.net);
      this.contract = makeContract(this.config, this.provider);
      if (this.contract.address !== this.snapshot.address) throw new Error('Jar address mismatch');
      this.set({ status: 'watching', statusMessage: undefined });
      // Coins already in the jar when the page opens are split too (nobody else did it yet).
      this.loop();
    } catch (error) {
      this.set({ status: 'offline', statusMessage: errorText(error) });
      if (!this.stopped) this.timer = setTimeout(() => this.start(), 5000);
    }
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  setAutoSplit(on: boolean) {
    this.set({ autoSplit: on });
    if (on) this.tick();
  }

  /** The next payment is first offered to a thief. The network has to refuse it. */
  armCheat() {
    this.set({ cheatArmed: true });
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
    if (this.busy || !this.contract) return;
    this.busy = true;
    try {
      const utxos = (await this.contract.getUtxos()).filter((u) => !u.token);
      this.failures = 0;
      if (this.snapshot.status !== 'watching') this.set({ status: 'watching', statusMessage: undefined });
      for (const u of utxos) {
        if (!this.seen.has(key(u))) {
          this.seen.set(key(u), performance.now());
          this.push({ kind: 'in', satoshis: u.satoshis, txid: u.txid });
        }
      }
      const open = utxos.filter((u) => !this.handled.has(key(u)));
      this.set({ waiting: open.length });
      if (!this.snapshot.autoSplit) return;

      const small: SpendableUtxo[] = [];
      for (const u of open) {
        if (this.snapshot.cheatArmed) await this.tryCheat(u);
        if (u.satoshis >= this.min) await this.split(u);
        else small.push(u);
      }
      if (small.length >= 2) {
        await this.merge(small[0], small[1]);
      } else if (small.length === 1 && !this.handled.has(`hold:${key(small[0])}`)) {
        this.handled.add(`hold:${key(small[0])}`);
        this.push({
          kind: 'hold',
          satoshis: small[0].satoshis,
          message: `Too small to split (the minimum is ${this.min} sats). It waits in the jar for the next small payment.`,
        });
      }
      this.set({ waiting: utxos.filter((u) => !this.handled.has(key(u))).length });
    } catch (error) {
      this.failures += 1;
      if (this.failures >= 3) this.set({ status: 'offline', statusMessage: errorText(error) });
    } finally {
      this.busy = false;
    }
  }

  /** Split one payment. Safe to call from many devices at once. */
  async split(utxo: SpendableUtxo) {
    if (!this.contract || !this.provider) return;
    const amounts = splitPot(utxo.satoshis, this.config.members.map((m) => m.bps));
    const tx = buildDistribute(this.contract, this.config, utxo);
    const seenAt = this.seen.get(key(utxo)) ?? performance.now();
    try {
      await broadcast(this.provider, tx);
      this.handled.add(key(utxo));
      this.push({ kind: 'split', satoshis: utxo.satoshis, txid: tx.txid, amounts, ms: Math.round(performance.now() - seenAt) });
    } catch (error) {
      if (isAlreadyKnown(error) || isConflict(error)) {
        // Another device sent the same split first. Same coin, same rules, same txid.
        this.handled.add(key(utxo));
        this.push({ kind: 'split', satoshis: utxo.satoshis, txid: tx.txid, amounts, byOther: true });
        return;
      }
      // Unknown failure (server hiccup, relay policy). Try again on the next ticks, then give up loudly.
      const tries = (this.retries.get(key(utxo)) ?? 0) + 1;
      this.retries.set(key(utxo), tries);
      if (tries >= 3) {
        this.handled.add(key(utxo));
        this.push({ kind: 'error', satoshis: utxo.satoshis, message: `Split failed: ${errorText(error)}` });
      }
    }
  }

  private async merge(a: SpendableUtxo, b: SpendableUtxo) {
    if (!this.contract || !this.provider) return;
    const tx = buildMerge(this.contract, a, b);
    try {
      await broadcast(this.provider, tx);
      this.handled.add(key(a));
      this.handled.add(key(b));
      this.push({ kind: 'merge', satoshis: a.satoshis + b.satoshis, txid: tx.txid, message: 'Two small payments joined inside the jar.' });
    } catch (error) {
      this.handled.add(key(a));
      this.handled.add(key(b));
      if (!isAlreadyKnown(error) && !isConflict(error)) {
        this.push({ kind: 'error', message: `Merge failed: ${errorText(error)}` });
      }
    }
  }

  private async tryCheat(utxo: SpendableUtxo) {
    if (!this.contract || !this.provider) return;
    this.set({ cheatArmed: false });
    const tx = buildCheat(this.contract, this.config, utxo);
    try {
      await broadcast(this.provider, tx);
      // If this ever happens the contract is broken. Say so loudly.
      this.push({ kind: 'error', txid: tx.txid, message: 'The network accepted the cheat. This should be impossible; please report it.' });
    } catch (error) {
      this.push({
        kind: 'cheat',
        satoshis: utxo.satoshis,
        message: errorText(error),
      });
    }
  }
}
