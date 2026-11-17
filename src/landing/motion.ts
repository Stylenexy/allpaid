import { gsap } from 'gsap';
import { clamp, sequenceAt, stageAt, stageStops } from './scene-progress';

/** One page progress drives the pinned world, its breathing, and the stage light. */
export function mountMotion(root: HTMLElement) {
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const hero = root.querySelector<HTMLElement>('.hero')!;
  const pin = hero.querySelector<HTMLElement>('.hero-in')!;
  const intro = hero.querySelector<HTMLElement>('.hero-intro')!;
  const finale = hero.querySelector<HTMLElement>('.hero-finale')!;
  const shell = hero.querySelector<HTMLElement>('.hero-art')!;
  let visible = true;
  let running = false;
  let dirty = true;
  let measure = true;
  let pageRange = 1;
  let start = 0;
  let travel = 1;
  let heroBottom = 0;
  let stops = stageStops(0, 0, 0, innerHeight);
  let heroP = 0;
  const reducedStage = document.documentElement.style.getPropertyValue('--stage');
  const set = (name: string, value: number) => hero.style.setProperty(name, value.toFixed(4));
  const offset = (selector: string) => (root.querySelector(selector)?.getBoundingClientRect().top ?? 0) + scrollY;
  const read = () => {
    const rect = hero.getBoundingClientRect();
    const top = rect.top + scrollY;
    const measuredTop = parseFloat(getComputedStyle(pin).top);
    const stickyTop = Number.isFinite(measuredTop) ? measuredTop : 64;
    start = top - stickyTop;
    travel = Math.max(1, hero.offsetHeight - pin.offsetHeight);
    heroBottom = top + hero.offsetHeight;
    pageRange = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    stops = stageStops(start + travel * .7, offset('.cheat-sec'), offset('.cta'), innerHeight);
    measure = false;
  };
  const frame = (time: number) => {
    if (dirty) {
      if (measure) read();
      const p = clamp(scrollY / pageRange);
      const position = p * pageRange;
      heroP = media.matches ? 1 : clamp((position - start) / travel);
      const scene = sequenceAt(heroP, media.matches);
      root.style.setProperty('--page-p', p.toFixed(5));
      set('--p', heroP);
      set('--lid-lift', scene.lid);
      set('--route-draw', scene.routes);
      set('--map-morph', scene.morph);
      set('--crew-split', scene.nested);
      set('--intro-opacity', scene.intro);
      set('--finale-opacity', scene.finale);
      intro.inert = !media.matches && scene.intro === 0;
      finale.inert = !media.matches && heroP < .98;
      intro.setAttribute('aria-hidden', String(intro.inert));
      finale.setAttribute('aria-hidden', String(!media.matches && scene.finale === 0));
      const color = stageAt(position, stops);
      document.documentElement.style.setProperty('--stage', `rgb(${color.join(' ')})`);
      dirty = false;
    }
    const breathe = scrollY < heroBottom && heroP < .65 && !media.matches;
    shell.style.setProperty('--breathe', breathe ? `${(Math.sin(time * 1.1) * 2).toFixed(2)}px` : '0px');
  };
  const sync = () => {
    hero.classList.toggle('motion-ready', !media.matches);
    hero.classList.toggle('motion-reduced', media.matches);
    dirty = true;
    measure = true;
    frame(0);
    const shouldRun = visible && !document.hidden && !media.matches;
    if (shouldRun && !running) { gsap.ticker.add(frame); running = true; }
    if (!shouldRun && running) { gsap.ticker.remove(frame); running = false; }
  };
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
  observer.observe(root);
  const scroll = () => { dirty = true; if (media.matches && !document.hidden) frame(0); };
  const resize = () => { measure = true; scroll(); };
  const sizes = new ResizeObserver(resize);
  sizes.observe(root);
  sizes.observe(pin);
  let anchored = false;
  const follow = (event: MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element) || !event.target.closest('a[href="#split"]') || media.matches) return;
    event.preventDefault();
    read();
    history.pushState(null, '', '#split');
    window.scrollTo({ top: start + travel, behavior: 'smooth' });
  };
  const anchor = () => {
    if (location.hash !== '#split' || media.matches || anchored) return;
    read();
    anchored = true;
    window.scrollTo({ top: start + travel, behavior: 'instant' });
    scroll();
  };
  window.addEventListener('scroll', scroll, { passive: true });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', sync);
  media.addEventListener('change', sync);
  root.addEventListener('click', follow);
  sync();
  anchor();
  return () => {
    observer.disconnect(); sizes.disconnect(); gsap.ticker.remove(frame);
    hero.classList.remove('motion-ready', 'motion-reduced');
    intro.inert = false; finale.inert = false;
    intro.removeAttribute('aria-hidden'); finale.removeAttribute('aria-hidden');
    if (reducedStage) document.documentElement.style.setProperty('--stage', reducedStage);
    else document.documentElement.style.removeProperty('--stage');
    window.removeEventListener('scroll', scroll); window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', sync); media.removeEventListener('change', sync);
    root.removeEventListener('click', follow);
  };
}
