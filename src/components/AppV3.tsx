// The inner pages (make a jar, the jar, the play-money jar) in the V3 world:
// dark stone, caps titles that rise line by line, glass panels that fade up.
// Motion here never uses ScrollTrigger: the landing kills every trigger when it
// unmounts, which can land after these pages mount.
import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { SplitText } from 'gsap/SplitText';
import { gsap, reducedMotion } from '../landing3/motion3';
import '@fontsource/inter-tight/latin-500.css';
import '@fontsource/inter-tight/latin-600.css';
import '../landing3/v3.css';
import '../styles/app-v3.css';

gsap.registerPlugin(SplitText);

/** Dark stone behind the page chrome too, while an inner page is open. */
export function useStonePage() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('v3-app');
    return () => root.classList.remove('v3-app');
  }, []);
}

/** The page title: caps, revealed line by line from behind a mask. */
export function Title({ children, id, className = '' }: { children: ReactNode; id?: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    const ctx = gsap.context(() => {
      SplitText.create(el, {
        type: 'lines',
        mask: 'lines',
        linesClass: 'v3-line',
        autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, { yPercent: 112, duration: 1.15, ease: 'expo.out', stagger: 0.09, delay: 0.08 }),
      });
    }, el);
    return () => ctx.revert();
  }, []);
  return (
    <h1 ref={ref} id={id} className={`v3-caps v3a-title ${className}`}>
      {children}
    </h1>
  );
}

/**
 * Panels marked [data-rise] fade up once, as they come into view. Opacity only
 * (never visibility), so keyboard focus still reaches a panel before it shows.
 */
export function useRise(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || reducedMotion() || typeof IntersectionObserver === 'undefined') return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-rise]'));
    if (!items.length) return;
    const ctx = gsap.context(() => gsap.set(items, { opacity: 0, y: 28 }), root);
    let first = true;
    const io = new IntersectionObserver(
      (entries) => {
        const shown = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
        if (!shown.length) return;
        shown.forEach((t) => io.unobserve(t));
        // What is on screen at load follows the title in; the rest rises as it arrives.
        const delay = first ? 0.35 : 0;
        first = false;
        ctx.add(() => gsap.to(shown, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.09, delay, clearProps: 'transform' }));
      },
      { rootMargin: '0px 0px -6% 0px' },
    );
    items.forEach((i) => io.observe(i));
    return () => {
      io.disconnect();
      ctx.revert();
    };
  }, [ref]);
}
