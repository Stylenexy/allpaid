import { SAMPLE_BAND } from '../../lib/sample';
import { levelCount, walletCount } from '../../lib/jar';
import { lazy, Suspense } from 'react';
const HeroDemo = lazy(() => import('../LiveDemo'));

/** Section 4: jars inside jars. */
export function SplitTrees() {
  const crew = SAMPLE_BAND.members.find((m) => m.jar);
  return (
    <section className="sec trees" id="split">
      <div className="wrap">
        <div className="scene-head"><h2 className="sec-title">The lid<br /><span className="chrome-type">is the law.</span></h2>
        <p className="sec-text">Agree on the shares once. A Bitcoin Cash covenant enforces the split, so no treasurer gets to rewrite the deal.</p></div>
        <div className="split-instrument"><Suspense fallback={<p>Loading the play-money instrument…</p>}><HeroDemo /></Suspense></div>
        <p className="sec-text">
          A member's address can be another Allpaid jar. A festival jar can pay each act's jar, and a band's jar pays its{' '}
          {crew?.name.toLowerCase() ?? 'crew'}'s jar like any other member; that jar splits again among {crew?.jar?.members.map((m) => m.name).join(', ')}. One payment,{' '}
          {levelCount(SAMPLE_BAND.members)} levels, {walletCount(SAMPLE_BAND.members)} wallets.
        </p>
        <p className="sec-text">
          The contract does not need to know: it pays locking bytecode, and a jar's address is a P2SH32 locking bytecode. The page sends the
          second split right after the first, spending the coin the first one just created. Each level costs one more 1,000-sat fee, and a
          jar refuses a payment too small for the next level to split again. Up to three levels: organiser, team, crew.
        </p>
      </div>
    </section>
  );
}
