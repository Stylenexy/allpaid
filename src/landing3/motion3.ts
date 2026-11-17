// One smooth-scroll engine for the V3 landing: Lenis drives the page, GSAP's
// ticker drives Lenis, and ScrollTrigger reads Lenis. Reduced motion = native scroll.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;

export function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Start smooth scrolling for the landing. Returns a cleanup. */
export function startSmooth(): () => void {
  if (reducedMotion()) return () => {};
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9 });
  document.documentElement.classList.add('lenis-on');
  lenis.on('scroll', ScrollTrigger.update);
  const tick = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return () => {
    gsap.ticker.remove(tick);
    lenis?.destroy();
    lenis = null;
    document.documentElement.classList.remove('lenis-on');
  };
}

/** Smoothly scroll to an element or y position (falls back to native). */
export function scrollToTarget(target: string | HTMLElement | number) {
  if (lenis) lenis.scrollTo(target as never, { duration: 1.4 });
  else if (typeof target === 'number') scrollTo({ top: target, behavior: 'smooth' });
  else (typeof target === 'string' ? document.querySelector(target) : target)?.scrollIntoView({ behavior: 'smooth' });
}

export { gsap, ScrollTrigger };
