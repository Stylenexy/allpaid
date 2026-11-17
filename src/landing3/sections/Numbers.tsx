// Numbers (Moto's "SPEND GLOBALLY / 0 FX FEES"): a white room where the real
// amounts of one sample split float at different depths. Near amounts are big,
// sharp and drift fast; far ones are small, faint, soft and lag behind, so the
// page reads as many payments landing at once. Every figure is from the sample
// band jar (100,000 sats in, 1,000 sats fee, seven member shares).
import { useRef } from 'react';
import { Caps, Photo, Scene, useMotion } from '../kit';
import { gsap } from '../motion3';
import './numbers.css';

type Amount = { v: string; x: number; y: number; d: number; m?: [number, number] };

// x / y are % of the scene; d is depth (0 = far, 1 = near); m is the phone
// position (amounts without one are left out on phones, where they would crowd
// the copy or each other).
const AMOUNTS: Amount[] = [
  // near
  { v: '+29,700', x: 5, y: 12, d: 0.95, m: [6, 7] },
  { v: '+24,750', x: 66, y: 7, d: 0.86, m: [40, 24] },
  { v: '+19,800', x: 57, y: 86, d: 0.9, m: [34, 88] },
  { v: '+9,500', x: 6, y: 80, d: 0.82, m: [6, 75] },
  // middle
  { v: '+5,937', x: 37, y: 19, d: 0.62, m: [54, 17] },
  { v: '+4,750', x: 86, y: 30, d: 0.55 },
  { v: '+3,563', x: 25, y: 90, d: 0.5, m: [60, 69] },
  { v: '1,000', x: 44, y: 95, d: 0.6 },
  { v: '+24,750', x: 2, y: 45, d: 0.45 },
  { v: '100,000', x: 72, y: 22, d: 0.5 },
  // far
  { v: '+29,700', x: 29, y: 5, d: 0.1 },
  { v: '+19,800', x: 90, y: 11, d: 0.2, m: [12, 27] },
  { v: '+9,500', x: 50, y: 3, d: 0.15, m: [64, 4] },
  { v: '+4,750', x: 13, y: 31, d: 0.25 },
  { v: '+5,937', x: 84, y: 60, d: 0.2 },
  { v: '+3,563', x: 11, y: 64, d: 0.12 },
  { v: '1,000', x: 93, y: 74, d: 0.15, m: [82, 77] },
  { v: '+24,750', x: 37, y: 76, d: 0.22 },
  { v: '+9,500', x: 76, y: 95, d: 0.3, m: [72, 97] },
  { v: '+19,800', x: 22, y: 70, d: 0.28 },
];

const FACTS = ['Any wallet can pay one address', 'Splits in seconds', 'No account, no custody'];

/** Depth → look: size 0.8–4rem, opacity 0.12–0.9, blur only on the faint ones. */
function look(d: number) {
  const size = 0.8 + d * 3.2;
  const opacity = 0.12 + d * 0.78;
  const blur = d < 0.35 ? (0.35 - d) * 7 : 0;
  return { size, opacity, blur };
}

/** Whether the scene before this one is dark (looks through a pin-spacer). */
function prevIsDark(section: HTMLElement) {
  let prev = section.previousElementSibling as HTMLElement | null;
  if (prev?.classList.contains('pin-spacer')) prev = prev.firstElementChild as HTMLElement | null;
  return !!prev?.classList.contains('v3-scene--dark');
}

export function Numbers() {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(ref, (reduced, el) => {
    // Coming out of a dark scene, rise through black into white (no hard edge).
    if (el.parentElement) el.classList.toggle('is-after-dark', prevIsDark(el.parentElement));
    if (reduced) return;

    // Parallax by depth: near amounts outrun the page, far ones lag behind it.
    gsap.utils.toArray<HTMLElement>('.v3-numbers-amt, .v3-numbers-coin', el).forEach((n) => {
      const d = Number(n.dataset.depth);
      const speed = (d - 0.35) * 2; // far -0.7 … near +1.3
      const isCoin = n.classList.contains('v3-numbers-coin');
      // Phones get a shorter drift so amounts never cross the copy.
      const amp = () => speed * innerHeight * (innerWidth <= 760 ? 0.08 : 0.2);
      gsap.fromTo(
        n,
        { y: () => amp(), rotation: isCoin ? -10 : 0 },
        {
          y: () => -amp(),
          rotation: isCoin ? 12 : 0,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
        },
      );
    });

    // The three facts settle in one after another, after the headline.
    gsap.from('.v3-numbers-facts li', {
      autoAlpha: 0,
      y: 18,
      duration: 0.9,
      ease: 'power3.out',
      stagger: 0.12,
      delay: 0.25,
      scrollTrigger: { trigger: '.v3-numbers-facts', start: 'top 88%', once: true },
    });
  });

  return (
    <Scene id="numbers" tone="light" className="v3-numbers">
      <div ref={ref} className="v3-numbers-root">
        <div className="v3-numbers-dip" aria-hidden="true" />
        <div className="v3-numbers-field" aria-hidden="true">
          {AMOUNTS.map((a, i) => {
            const { size, opacity, blur } = look(a.d);
            return (
              <span
                key={i}
                className={`v3-numbers-amt${a.m ? '' : ' is-wide-only'}`}
                data-depth={a.d}
                style={{
                  ['--x' as string]: a.x,
                  ['--y' as string]: a.y,
                  ['--mx' as string]: a.m?.[0] ?? a.x,
                  ['--my' as string]: a.m?.[1] ?? a.y,
                  ['--s' as string]: size,
                  opacity,
                  filter: blur ? `blur(${blur.toFixed(2)}px)` : undefined,
                  zIndex: Math.round(a.d * 10),
                }}
              >
                {a.v}
                <small>sats</small>
              </span>
            );
          })}
          <div className="v3-numbers-coin" data-depth={0.7}>
            <Photo name="coin-slices" alt="" />
          </div>
        </div>
        <div className="v3-inner v3-numbers-copy">
          <Caps>
            Split every tip.
            <br />
            About $0.002 each.
          </Caps>
          <ul className="v3-numbers-facts" role="list">
            {FACTS.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      </div>
    </Scene>
  );
}
