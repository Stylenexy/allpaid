// The coin cursor: a small ring that follows the pointer. Over the tin
// ([data-cursor="coin"]) it becomes a coin; over a pay action
// ([data-cursor="split"]) it splits into four, the way a payment does.
// Only for fine pointers; hidden with reduced motion.
import { useEffect, useRef } from 'react';
import { gsap, reducedMotion } from './motion3';

export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion() || !matchMedia('(pointer: fine)').matches) return;
    document.documentElement.classList.add('v3-has-cursor');
    const x = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3.out' });
    const y = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3.out' });
    let px = -1;
    let py = -1;
    const modeAt = (target: Element | null) => {
      const hit = target?.closest?.('[data-cursor], a, button');
      const mode = hit?.getAttribute('data-cursor') ?? (hit ? 'link' : 'idle');
      if (el.dataset.mode !== mode) el.dataset.mode = mode;
    };
    const move = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      x(px);
      y(py);
      modeAt(e.target as Element | null);
    };
    // Scrolling moves the page under a still pointer: read what is under it now.
    let queued = false;
    const scrolled = () => {
      if (queued || px < 0) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; modeAt(document.elementFromPoint(px, py)); });
    };
    const leave = () => { el.dataset.mode = 'hidden'; };
    addEventListener('pointermove', move, { passive: true });
    addEventListener('scroll', scrolled, { passive: true });
    document.addEventListener('pointerleave', leave);
    return () => {
      removeEventListener('scroll', scrolled);
      removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
      document.documentElement.classList.remove('v3-has-cursor');
    };
  }, []);
  return (
    <div ref={ref} className="v3-cursor" data-mode="hidden" aria-hidden="true">
      <span className="v3-cursor-ring" />
      <span className="v3-cursor-coin" />
      <span className="v3-cursor-split"><i /><i /><i /><i /></span>
    </div>
  );
}
