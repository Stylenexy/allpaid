import { SAMPLE_BAND } from '../../lib/sample';
import { levelCount, walletCount } from '../../lib/jar';

/** Section 4: jars inside jars. */
export function SplitTrees() {
  const crew = SAMPLE_BAND.members.find((m) => m.jar);
  return (
    <section className="sec trees">
      <div className="wrap narrow">
        <h2 className="sec-title">A revenue waterfall, in one payment</h2>
        <p className="sec-text">
          A member's address can be another Splitjar. A festival jar can pay each act's jar, and a band's jar pays its{' '}
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
