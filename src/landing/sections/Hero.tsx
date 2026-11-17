import { lazy, Suspense, useEffect, useRef } from 'react';
import { onLinkClick } from '../../router';
import vessel from '../noir-vessel.svg?raw';
const HeroPayment = lazy(() => import('../HeroPayment').then((m) => ({ default: m.HeroPayment })));
export function Hero() {
  const stage = useRef<HTMLElement>(null);
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let alive = true;
    import('../motion').then(({ mountMotion }) => {
      if (alive && stage.current) dispose = mountMotion(stage.current);
    });
    return () => { alive = false; dispose?.(); };
  }, []);
  return (
    <section className="sec hero" ref={stage}>
      <div className="wrap hero-in">
        <h1 className="hero-title">One QR.<br /><span className="chrome-type">Everyone gets paid.</span></h1>
        <div className="hero-art" dangerouslySetInnerHTML={{ __html: vessel }} />
        <div className="hero-foot">
        <div className="hero-copy">
          <p className="hero-lead">A shared tip can with rules enforced by a Bitcoin Cash covenant. No treasurer. No custody.</p>
          <div className="ctas">
            <a className="btn btn-money" href="/new" onClick={onLinkClick}>Make your team's jar <span aria-hidden="true">↗</span></a>
            <a className="btn btn-quiet" href="#split">Follow the money <span aria-hidden="true">↓</span></a>
          </div>
        </div>
        <Suspense fallback={<p className="hero-payment">Preparing the demo jar…</p>}><HeroPayment /></Suspense>
        </div>
      </div>
    </section>
  );
}
