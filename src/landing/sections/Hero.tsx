import { lazy, Suspense } from 'react';
import { onLinkClick } from '../../router';

const HeroDemo = lazy(() => import('../LiveDemo'));

/** Section 1: what it is, for whom, and a live split you can trigger. */
export function Hero() {
  return (
    <section className="sec hero">
      <div className="wrap hero-in">
        <div className="hero-copy">
          <h1 className="hero-title">
            One QR.
            <br />
            Everyone gets paid.
          </h1>
          <p className="hero-lead">
            Splitjar is a shared tip jar on Bitcoin Cash. Every payment to the group's QR is split to each member's wallet within seconds, in
            shares fixed by a contract. A member can be another jar, so one payment can pay a whole band and its crew.
          </p>
          <div className="ctas">
            <a className="btn btn-primary" href="/new" onClick={onLinkClick}>
              Make a jar for your group
            </a>
            <a className="btn" href="#cheat">
              Try to cheat it
            </a>
          </div>
          <p className="hero-small">Free and open source. No account. Payers use any Bitcoin Cash wallet, or connect one with WizardConnect.</p>
        </div>
        <Suspense fallback={<div className="demo-card is-loading">Starting the play-money network…</div>}>
          <HeroDemo />
        </Suspense>
      </div>
    </section>
  );
}
