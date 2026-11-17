import { gsap } from 'gsap';

/** A single ticker owns scroll progress and the jar's breathing motion. */
export function mountMotion(root: HTMLElement) {
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const shell = root.querySelector('.hero-art');
  gsap.set(shell, { force3D: true });
  const setY = gsap.quickSetter(shell, 'y', 'px');
  let visible = false;
  let running = false;
  let dirty = true;
  let p = 0;
  const frame = (time: number) => {
    if (dirty) {
      const rect = root.getBoundingClientRect();
      p = Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height)));
      root.style.setProperty('--p', String(p));
      dirty = false;
    }
    setY(Math.sin(time * 1.1) * 3 - p * 14);
  };
  const sync = () => {
    const shouldRun = visible && !document.hidden && !media.matches;
    if (shouldRun && !running) { dirty = true; gsap.ticker.add(frame); running = true; }
    if (!shouldRun && running) { gsap.ticker.remove(frame); running = false; }
    root.classList.toggle('motion-active', shouldRun);
    if (media.matches) gsap.set(shell, { clearProps: 'transform' });
  };
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
  observer.observe(root);
  const scroll = () => { dirty = true; };
  window.addEventListener('scroll', scroll, { passive: true });
  window.addEventListener('resize', scroll);
  document.addEventListener('visibilitychange', sync);
  media.addEventListener('change', sync);
  return () => {
    observer.disconnect(); gsap.ticker.remove(frame);
    gsap.set(shell, { clearProps: 'transform' });
    window.removeEventListener('scroll', scroll); window.removeEventListener('resize', scroll);
    document.removeEventListener('visibilitychange', sync); media.removeEventListener('change', sync);
  };
}
