// Stack (Moto's stacked caps list): the tin alone on a dark table by a window.
// The wall holds still while the list rises on the right; as each promise
// passes the middle of the screen the window light sweeps across it from the
// left, from faint to white. What is left lit at the end is everything the jar
// takes away (the treasurer, custody, an owner key, a changeable cut) and what
// it gives (fast splits, any wallet).
import { useRef } from 'react';
import { Scene, useMotion, Wall } from '../kit';
import { gsap } from '../motion3';
import './stack.css';

const LINES = ['No treasurer', 'No custody', 'No owner key', 'No way to change the cut', 'Splits in seconds', 'Any wallet can pay'];

/** Whether the scene after this one is light (looks through a pin-spacer). */
function nextIsLight(section: HTMLElement) {
  let next = section.nextElementSibling as HTMLElement | null;
  if (next?.classList.contains('pin-spacer')) next = next.firstElementChild as HTMLElement | null;
  return !!next?.classList.contains('v3-scene--light');
}

export function Stack() {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(ref, (reduced, el) => {
    // Going into a light scene, the room fades through black into white.
    if (el.parentElement) el.classList.toggle('is-before-light', nextIsLight(el.parentElement));
    if (reduced) return; // CSS final state: every line lit.
    el.classList.add('is-animated');
    gsap.utils.toArray<HTMLElement>('.v3-stack-line', el).forEach((line) => {
      gsap.fromTo(
        line,
        { backgroundPosition: '100% 0', opacity: 0.55, y: 26 },
        {
          backgroundPosition: '0% 0',
          opacity: 1,
          y: 0,
          ease: 'none',
          scrollTrigger: { trigger: line, start: 'center 88%', end: 'center 58%', scrub: true },
        },
      );
    });
    // The room settles very slightly while the list is read.
    gsap.fromTo(
      '.v3-stack-zoom',
      { scale: 1.06 },
      { scale: 1, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom bottom', scrub: true } },
    );
  });

  return (
    <Scene id="stack" tone="dark" className="v3-stack">
      <div ref={ref} className="v3-stack-root">
        <div className="v3-stack-sticky">
          <div className="v3-stack-zoom">
            <Wall
              name="wall-room"
              alt="A brushed steel tip tin alone on a dark wooden table, lit by a window on the left"
              position="100% 50%"
            />
          </div>
        </div>
        <div className="v3-stack-body">
          <ul className="v3-stack-list" role="list" aria-label="What a jar guarantees">
            {LINES.map((l) => (
              <li key={l} className="v3-stack-line">
                {l}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="v3-stack-dip" aria-hidden="true" />
    </Scene>
  );
}
