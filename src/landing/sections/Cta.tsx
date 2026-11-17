import { onLinkClick } from '../../router';
import { SITE } from '../../site';

/** Section 8: the closing call to action. */
export function Cta() {
  return (
    <section className="sec cta">
      <div className="wrap cta-in">
        <h2 className="sec-title">One address.<br /><span className="chrome-type">Your whole team.</span></h2>
        <div className="ctas">
          <a className="btn btn-primary" href="/new" onClick={onLinkClick}>
            Make your team's jar
          </a>
          <a className="btn" href={SITE.demoJarPath || '/try'} onClick={onLinkClick}>
            {SITE.demoJarPath ? 'Pay into our demo jar on mainnet' : 'Open the play-money jar'}
          </a>
        </div>
        <ul className="cta-plan" aria-label="How Allpaid is paid for">
          <li>Free for teams</li>
          <li>Event templates can include Allpaid as a visible, opt-in 0.5% member written into the address</li>
          <li>Hosted keeper with payout alerts for venues</li>
        </ul>
        <p className="cta-why">
          <strong>Why not a multi-output payment?</strong> Any wallet or exchange can pay one address, and the cut is checkable in the address itself.
        </p>
      </div>
    </section>
  );
}
