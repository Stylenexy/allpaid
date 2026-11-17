import { sats } from '../../lib/format';
import { SPLIT_FEE } from '../../lib/jar';

/** Section 6: why Bitcoin Cash. */
export function WhyBch() {
  return (
    <section className="sec why">
      <div className="wrap two-col">
        <h2 className="sec-title">Small payments.<br /><span className="chrome-type">Built on Bitcoin Cash.</span></h2>
        <dl className="why-list">
          <div>
            <dt>The contract checks its own spending.</dt>
            <dd>
              Bitcoin Cash scripts can read the transaction that spends them (native introspection, since 2022). That is how a jar insists on
              its own split without anyone signing.
            </dd>
          </div>
          <div>
            <dt>Small payments stay worth splitting.</dt>
            <dd>
              A split costs <span className="num">{sats(SPLIT_FEE)}</span> sats however many members there are, a fraction of a cent, so a
              coffee-sized tip can still be shared.
            </dd>
          </div>
          <div>
            <dt>Seconds, not blocks.</dt>
            <dd>The payment is visible to the network as soon as it is sent, and the split follows right after, without waiting for a block.</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
