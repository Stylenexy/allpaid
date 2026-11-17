import { SAMPLE_SHAPE } from '../../lib/sample-shape';
import { levelCount, walletCount } from '../../lib/shares';
import { lazy, Suspense } from 'react';
const HeroDemo = lazy(() => import('../LiveDemo'));

/** The pinned world's final frame is also the working split instrument. */
export function SplitTrees() {
  return (
    <section className="trees" id="split">
      <div>
        <div className="scene-head"><h2 className="sec-title">The lid is the law.</h2>
        <p className="sec-text">Agree on the shares once. A Bitcoin Cash covenant enforces the split, so no treasurer gets to rewrite the deal.</p></div>
        <div className="split-instrument"><Suspense fallback={<p>Loading the play-money instrument…</p>}><HeroDemo /></Suspense></div>
        <p className="sec-text">
          Road crew is a jar of its own. Its share splits again: {levelCount(SAMPLE_SHAPE.members)} levels, {walletCount(SAMPLE_SHAPE.members)} wallets.
          {' '}Each level costs 1,000 sats. Anyone can send the agreed split; nobody can change it.
        </p>
      </div>
    </section>
  );
}
