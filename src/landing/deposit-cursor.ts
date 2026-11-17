import type { JarEvent, JarSnapshot } from '../lib/engine';

/** Ignore the opening balance and illuminate only newly observed root deposits. */
export class DepositCursor {
  private ready = false;
  private seen = new Set<string>();

  read(snapshot: Pick<JarSnapshot, 'pollCount' | 'events'>): JarEvent | undefined {
    if (!snapshot.pollCount) return;
    const deposits = snapshot.events.filter((event) => event.kind === 'in' && event.node === '0');
    const fresh = this.ready ? deposits.find((event) => !this.seen.has(event.id)) : undefined;
    this.seen = new Set(deposits.map((event) => event.id));
    this.ready = true;
    return fresh;
  }
}
