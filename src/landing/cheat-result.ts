import type { JarEvent } from '../lib/engine';

/** Events are newest-first. An old payment must never light a new attack green. */
export function cheatResult(events: readonly JarEvent[]) {
  const refusedAt = events.findIndex((event) => event.kind === 'cheat');
  if (refusedAt < 0) return { refusal: undefined, honest: false };
  const after = events.slice(0, refusedAt);
  const root = after.find((event) => event.kind === 'split' && event.node === '0');
  const crew = after.find((event) => event.kind === 'split' && event.node === '0.3');
  return { refusal: events[refusedAt], honest: Boolean(root && crew) };
}
