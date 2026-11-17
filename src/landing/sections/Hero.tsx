import { lazy, Suspense } from 'react';
import { onLinkClick } from '../../router';
import vessel from '../noir-vessel.svg?raw';
import { SplitTrees } from './SplitTrees';
const HeroPayment = lazy(() => import('../HeroPayment').then((m) => ({ default: m.HeroPayment })));
export function Hero() {
  return (
    <section className="hero" aria-label="One payment, fixed shares">
      <div className="wrap hero-in">
        <div className="hero-intro">
          <h1 className="hero-title">One QR.<br /><span className="chrome-type">Everyone <span className="keep-words">gets paid.</span></span></h1>
          <div className="hero-art" dangerouslySetInnerHTML={{ __html: vessel }} />
          <div className="hero-foot">
            <div className="hero-copy">
              <p className="hero-lead">One Bitcoin Cash address that pays your whole team, in shares a covenant locks. No treasurer. No custody.</p>
              <div className="ctas">
                <a className="btn btn-money" href="/new" onClick={onLinkClick}>Make your team's jar <span aria-hidden="true">↗</span></a>
                <a className="btn btn-quiet" href="#split">Follow the money <span aria-hidden="true">↓</span></a>
              </div>
            </div>
            <Suspense fallback={<p className="hero-payment">Preparing the demo jar…</p>}><HeroPayment /></Suspense>
          </div>
        </div>
        <div className="hero-finale"><SplitTrees /></div>
      </div>
    </section>
  );
}
