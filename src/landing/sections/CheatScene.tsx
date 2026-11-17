import { lazy, Suspense } from 'react';
import { SAMPLE_SHAPE } from '../../lib/sample-shape';

const CheatDemo = lazy(() => import('../LiveDemo').then((m) => ({ default: m.CheatDemo })));

/** Section 5: attack the jar and watch the VM refuse. */
export function CheatScene() {
  const first = SAMPLE_SHAPE.members[0].name;
  return (
    <section className="sec cheat-sec" id="cheat">
      <div className="wrap two-col">
        <div>
          <h2 className="sec-title">Try to cheat.<br /><span className="chrome-type">The lid stays shut.</span></h2>
          <p className="sec-text">
            Imagine one member wants more than the agreed share. The thief can send the whole tip to {first}, or pay everyone with the right total but two
            amounts swapped. Either way the transaction spends the jar's coin with the right input and a fair-looking fee, and goes straight to the Bitcoin Cash
            VM, with no check on our side first.
          </p>
          <p className="sec-text">Below it: the VM's own refusal, and the line of the contract that caught the thief. Each cheat trips a different line.</p>
        </div>
        <Suspense fallback={<div className="demo-card is-loading">Loading the play-money network…</div>}>
          <CheatDemo />
        </Suspense>
      </div>
    </section>
  );
}
