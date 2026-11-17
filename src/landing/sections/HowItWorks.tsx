import { sats } from '../../lib/format';
import { SPLIT_FEE } from '../../lib/jar';

/** Section 3: the path of one payment. */
export function HowItWorks() {
  return (
    <section className="sec how" id="how">
      <div className="wrap">
        <h2 className="sec-title">An agreement you can inspect</h2>
        <div className="facts">
          <p>The split has no signature and no choices in it. Two phones racing to send it send the same bytes, with the same transaction id.</p>
          <p>
            Its fee, <span className="num">{sats(SPLIT_FEE)}</span> sats per jar, is paid from the payment, so whoever presses split needs no
            wallet and gains nothing from it.
          </p>
          <p>
            The members and shares are part of the jar's address. Change one share and you get a different address. The jar link carries the
            list, so a payer can check what the QR will do with their money.
          </p>
        </div>
      </div>
    </section>
  );
}
