// Preloader (Moto's world clocks): a black curtain for the first visit of a
// session. The tin mark fills from the bottom the way a tin fills with coins,
// then its split branch lights green; four corners carry quiet real data.
// Shown once per session, never with reduced motion.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TinMark } from '../../components/TinMark';
import { gsap, reducedMotion } from '../motion3';
import './preloader.css';

const KEY = 'v3-preloaded';
/** Fired on window when the curtain starts to lift; the hero starts its entrance then. */
export const PRELOADER_DONE = 'v3:preloaded';

function shouldShow() {
  if (typeof window === 'undefined' || reducedMotion()) return false;
  try {
    return sessionStorage.getItem(KEY) !== '1';
  } catch {
    return true;
  }
}

const jogjaClock = () =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());

export function Preloader() {
  const [show, setShow] = useState(shouldShow);
  const [time, setTime] = useState(jogjaClock);
  const ref = useRef<HTMLDivElement>(null);

  // Tell the hero whether to wait for the curtain (layout effects run before the hero's).
  useLayoutEffect(() => {
    document.documentElement.dataset.v3Preloader = show ? 'on' : 'off';
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const tick = setInterval(() => setTime(jogjaClock()), 1000);
    return () => clearInterval(tick);
  }, [show]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!show || !el) return;
    // Hold the page still while the curtain is down (Lenis listens on window, bubble phase).
    const block = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const opts = { capture: true, passive: false } as const;
    addEventListener('wheel', block, opts);
    addEventListener('touchmove', block, opts);

    const finish = () => {
      try {
        sessionStorage.setItem(KEY, '1');
      } catch {
        /* private mode: it shows again next time, nothing breaks */
      }
      setShow(false);
    };
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.v3-preloader-corner', { autoAlpha: 0, y: 8, duration: 0.6, stagger: 0.06 }, 0.05)
        .from('.v3-preloader-mark', { autoAlpha: 0, scale: 0.92, duration: 0.7 }, 0)
        // The tin fills: a bright copy of the mark is revealed from the bottom up.
        .fromTo('.v3-preloader-fill', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.05, ease: 'power2.inOut' }, 0.2)
        .fromTo('.v3-preloader-glow', { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.8 }, 0.8)
        .add(() => {
          removeEventListener('wheel', block, opts);
          removeEventListener('touchmove', block, opts);
          document.documentElement.dataset.v3Preloader = 'off';
          // Outside this timeline's callback, so the hero's entrance is not recorded (and reverted) here.
          setTimeout(() => dispatchEvent(new Event(PRELOADER_DONE)), 0);
        }, 1.6)
        .to('.v3-preloader-mark', { scale: 1.12, autoAlpha: 0, duration: 0.7, ease: 'power2.in' }, 1.6)
        .to('.v3-preloader-corner', { autoAlpha: 0, duration: 0.4, ease: 'power1.in' }, 1.6)
        .to(el, { autoAlpha: 0, duration: 0.8, ease: 'power2.inOut' }, 1.75)
        .add(finish);
    }, el);
    return () => {
      removeEventListener('wheel', block, opts);
      removeEventListener('touchmove', block, opts);
      ctx.revert();
    };
  }, [show]);

  if (!show) return null;
  return (
    <div ref={ref} className="v3-preloader" aria-hidden="true">
      <div className="v3-preloader-mark">
        <span className="v3-preloader-glow" />
        <span className="v3-preloader-base"><TinMark size={88} /></span>
        <span className="v3-preloader-fill"><TinMark size={88} /></span>
      </div>
      <span className="v3-preloader-corner v3-preloader-corner--tl" title="BCH price on 17 Nov 2026">BCH $209.07</span>
      <span className="v3-preloader-corner v3-preloader-corner--tr">Fee per split ≈ $0.002</span>
      <span className="v3-preloader-corner v3-preloader-corner--bl">Jogja {time}</span>
      <span className="v3-preloader-corner v3-preloader-corner--br">One payment · 7 wallets</span>
    </div>
  );
}
