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
            Splitjar is a Bitcoin Cash address that pays a whole team. Pay it once, and a covenant pays every member their share within
            seconds. No treasurer, and no way to change the cut. A member can be another team's Splitjar, so money can flow down a whole
            waterfall: organiser, band, crew.
          </p>
          <div className="ctas">
            <a className="btn btn-primary" href="/new" onClick={onLinkClick}>
              Make a Splitjar for your team
            </a>
            <a className="btn" href="#cheat">
              Try to cheat it
            </a>
          </div>
          <p className="hero-small">
            Free and open source. No account. Payers use any Bitcoin Cash wallet, or connect one with WizardConnect. Close the tab and members
            still get paid: a keeper sends the split.
          </p>
        </div>
        <Suspense fallback={<div className="demo-card is-loading">Starting the play-money network…</div>}>
          <HeroDemo />
        </Suspense>
      </div>
    </section>
  );
}
