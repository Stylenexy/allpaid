import { lazy, Suspense } from 'react';
import { SAMPLE_BAND } from '../../lib/sample';

const CheatDemo = lazy(() => import('../LiveDemo').then((m) => ({ default: m.CheatDemo })));

/** Section 5: attack the jar and watch the VM refuse. */
export function CheatScene() {
  const first = SAMPLE_BAND.members[0].name;
  return (
    <section className="sec cheat-sec" id="cheat">
      <div className="wrap two-col">
        <div>
          <h2 className="sec-title">Try to cheat.<br /><span className="chrome-type">The lid stays shut.</span></h2>
          <p className="sec-text">
            Imagine one member wants the whole tip. The thief builds a transaction that spends the jar's coin and sends all of it to {first}. It has the right input
            and a fair-looking fee. It goes straight to the Bitcoin Cash VM, with no check on our side first.
          </p>
          <p className="sec-text">Below it: the VM's own refusal, and the line of the contract that caught the thief.</p>
        </div>
        <Suspense fallback={<div className="demo-card is-loading">Loading the play-money network…</div>}>
          <CheatDemo />
        </Suspense>
      </div>
    </section>
  );
}
