// Cheat: the dark interlude. A marble hand reaches for the tin and is stopped
// by a vertical blade of light (the covenant). While the scene is pinned the
// camera pushes in on that fingertip, and two cheating transactions travel
// across the empty dark toward the blade as thin lines of light. Each one stops
// dead at the blade, the blade flashes refusal red, and a glass chip names the
// contract line that refused it (32: one output per member, no extra outputs;
// 39: an output has the wrong amount). Nothing is drawn on the hand or the tin.
import { useRef } from 'react';
import { Caps, Chip, Lede, Pill, Scene, useMotion, Wall } from '../kit';
import { gsap } from '../motion3';
import './cheat.css';

// Paths in the photo's own pixels (1672 × 941). The blade stands at x = 496.
const ATTEMPTS = [
  { d: 'M1300 572 C 1060 572 830 604 500 604', from: [1300, 572], hit: 604, chip: 'Everything to one member · refused at line 32' },
  { d: 'M1300 662 C 1060 662 830 682 500 682', from: [1300, 662], hit: 682, chip: 'Two amounts swapped · refused at line 39' },
] as const;
const BLADE_X = 496;

export function Cheat() {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(ref, (reduced, el) => {
    const q = gsap.utils.selector(el);
    if (reduced) {
      // Final state: both attempts drawn, refused, labelled. No pin, no flash.
      gsap.set(q('.v3-cheat-line'), { opacity: 0.45 });
      gsap.set(q('.v3-cheat-stop'), { opacity: 1 });
      return;
    }

    const stage = q('.v3-cheat-stage')[0];
    const frame = q('.v3-cheat-frame')[0];
    const mm = gsap.matchMedia();
    mm.add({ wide: '(min-width: 761px)', narrow: '(max-width: 760px)' }, (mctx) => {
      const wide = !!mctx.conditions?.wide;
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: wide
          ? { trigger: stage, start: 'top top', end: '+=150%', pin: true, scrub: true, anticipatePin: 1 }
          : { trigger: frame, start: 'top 85%', end: 'bottom 55%', scrub: true },
      });
      // The camera leans in on the fingertip at the blade for the whole scene.
      tl.fromTo(q('.v3-cheat-zoom'), { scale: 1 }, { scale: 1.08, duration: 1 }, 0);

      ATTEMPTS.forEach((_, i) => {
        const t0 = i === 0 ? 0.06 : 0.46;
        const hit = t0 + 0.3;
        const line = q(`.v3-cheat-try--${i} .v3-cheat-line, .v3-cheat-try--${i} .v3-cheat-glowline`);
        // A transaction leaves its wallet...
        tl.fromTo(q(`.v3-cheat-try--${i} .v3-cheat-node`), { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 0.04, ease: 'power2.out' }, t0)
          // ...and travels toward the coins...
          .fromTo(line, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.3 }, t0 + 0.01)
          // ...until the covenant stops it: the blade flashes red, the path goes cold.
          .fromTo(q('.v3-cheat-flash'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.025, ease: 'power2.out', immediateRender: i === 0 }, hit)
          .to(q('.v3-cheat-flash'), { autoAlpha: 0, duration: 0.12, ease: 'power2.in' }, hit + 0.03)
          .fromTo(q(`.v3-cheat-try--${i} .v3-cheat-hit`), { autoAlpha: 0, scale: 0.4, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 0.03, ease: 'power2.out' }, hit)
          .to(q(`.v3-cheat-try--${i} .v3-cheat-hit`), { autoAlpha: 0, duration: 0.12, ease: 'power2.in' }, hit + 0.04)
          .fromTo(q(`.v3-cheat-try--${i} .v3-cheat-stop`), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.02 }, hit)
          .to(line, { opacity: 0.4, duration: 0.1 }, hit + 0.03)
          .fromTo(q(`.v3-cheat-chip--${i}`), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.07, ease: 'power3.out' }, hit + 0.02);
      });
    });
    return () => mm.revert();
  });

  return (
    <Scene id="cheat" tone="dark" className="v3-cheat">
      <div ref={ref} className="v3-cheat-root">
        <div className="v3-cheat-stage">
          <div className="v3-cheat-copy">
            <Caps align="left">
              Try to cheat it.
              <br />
              The network says no.
            </Caps>
          </div>
          <div className="v3-cheat-aside">
            <Lede>Send everything to one member, or quietly swap two amounts. Nodes refuse both, each at its own line of the contract.</Lede>
            <div className="v3-actions">
              <Pill href="/try" tone="light">
                Try to cheat it
              </Pill>
            </div>
          </div>

          <div className="v3-cheat-frame">
            <div className="v3-cheat-zoom">
              <Wall
                name="wall-cheat"
                alt="A marble hand reaches for a steel tin on a black stone block and stops at a thin vertical blade of light"
              />
            </div>
            <div className="v3-cheat-geo" aria-hidden="true">
              <span className="v3-cheat-flash" style={{ left: `${(BLADE_X / 1672) * 100}%` }} />
              <svg viewBox="0 0 1672 941" preserveAspectRatio="none" className="v3-cheat-paths">
                <defs>
                  <radialGradient id="v3-cheat-hitglow">
                    <stop offset="0" stopColor="#ff6b5e" stopOpacity="0.85" />
                    <stop offset="0.35" stopColor="#ff6b5e" stopOpacity="0.32" />
                    <stop offset="1" stopColor="#ff6b5e" stopOpacity="0" />
                  </radialGradient>
                </defs>
                {ATTEMPTS.map((a, i) => (
                  <g key={i} className={`v3-cheat-try v3-cheat-try--${i}`}>
                    <path className="v3-cheat-glowline" d={a.d} pathLength={1} />
                    <path className="v3-cheat-line" d={a.d} pathLength={1} />
                    <circle className="v3-cheat-node" cx={a.from[0]} cy={a.from[1]} r={4.5} />
                    <circle className="v3-cheat-hit" cx={BLADE_X} cy={a.hit} r={58} fill="url(#v3-cheat-hitglow)" />
                    <path className="v3-cheat-stop" d={`M${BLADE_X} ${a.hit - 15} V${a.hit + 15}`} />
                  </g>
                ))}
              </svg>
            </div>
          </div>

          <div className="v3-cheat-chips">
            {ATTEMPTS.map((a, i) => (
              <Chip key={i} tone="refused" className={`v3-cheat-chip v3-cheat-chip--${i}`}>
                {a.chip}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </Scene>
  );
}
