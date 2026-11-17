// Closing: Moto's dark footer. Jogja at night opens from a framed picture on
// the white page to the full screen (light hands over to night without a hard
// edge), one last statement and the two actions, a quiet footer row, and the
// name rising out of the bottom edge as the page ends.
import { useRef } from 'react';
import { TinMark } from '../../components/TinMark';
import { SITE } from '../../site';
import { Caps, Pill, Scene, useMotion } from '../kit';
import { gsap } from '../motion3';
import './closing.css';

const WORD = 'ALLPAID';

export function Closing() {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(ref, (reduced, el) => {
    if (reduced) return;
    const stage = el.querySelector('.v3-closing-stage');
    // The night opens: framed picture -> full bleed, the city settling in.
    gsap.fromTo(
      el.querySelector('.v3-closing-frame'),
      { clipPath: 'inset(9% 5% 0% 5% round 28px)' },
      { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', scrollTrigger: { trigger: stage, start: 'top bottom', end: 'top top', scrub: 0.6 } },
    );
    gsap.fromTo(
      el.querySelector('.v3-closing-frame .v3-wall'),
      { scale: 1.16 },
      { scale: 1, ease: 'none', scrollTrigger: { trigger: stage, start: 'top bottom', end: 'bottom top', scrub: 0.6 } },
    );
    gsap.from(el.querySelector('.v3-closing-inner .v3-actions'), {
      y: 24,
      autoAlpha: 0,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: el.querySelector('.v3-closing-inner'), start: 'top 60%', once: true },
    });
    gsap.from(el.querySelectorAll('.v3-closing-foot > *'), {
      y: 16,
      autoAlpha: 0,
      duration: 0.8,
      ease: 'power3.out',
      stagger: 0.06,
      scrollTrigger: { trigger: el.querySelector('.v3-closing-foot'), start: 'top 95%', once: true },
    });
    // The name rises out of the bottom edge, letter by letter, as the page ends.
    gsap.from(el.querySelectorAll('.v3-closing-word span'), {
      yPercent: 75,
      ease: 'none',
      stagger: 0.08,
      scrollTrigger: { trigger: el.querySelector('.v3-closing-end'), start: 'top bottom', end: () => `+=${el.querySelector<HTMLElement>('.v3-closing-end')?.offsetHeight ?? 200}`, scrub: 0.6 },
    });
  });

  return (
    <Scene id="closing" tone="dark" className="v3-closing">
      <div ref={ref}>
        <div className="v3-closing-stage">
          <div className="v3-closing-frame">
            {/* Same wall as kit's Wall, but chosen by width (srcset) so phones,
                which crop this wide night into a tall frame, get the sharp file. */}
            <div className="v3-wall v3-shade-bottom">
              <img
                src="/v3/wall-jogja.webp"
                srcSet="/v3/wall-jogja-sm.webp 900w, /v3/wall-jogja.webp 1913w"
                sizes="(max-width: 760px) 260vw, 100vw"
                alt="Yogyakarta at night: city lights across the valley below Mount Merapi"
                loading="lazy"
                decoding="async"
                style={{ objectPosition: '76% 50%' }}
              />
            </div>
            <div className="v3-inner v3-closing-inner">
              <Caps align="left" className="v3-closing-title">
                A fairer way<br />to split the night.
              </Caps>
              <div className="v3-actions">
                <Pill href="/new" tone="money" cursor="split">Make your team’s jar</Pill>
                <Pill href="/try" tone="light">Try it with play money</Pill>
              </div>
            </div>
          </div>
        </div>

        <footer className="v3-inner v3-closing-foot">
          <span className="v3-closing-brand">
            <TinMark size={26} />
            <span>Allpaid</span>
          </span>
          <a href={SITE.slidesUrl} target="_blank" rel="noreferrer">Slides</a>
          <a href={SITE.repoUrl} target="_blank" rel="noreferrer">Source code</a>
          <span>Not audited: use small amounts</span>
          <span>Built for BCH BLAZE 2026</span>
        </footer>

        <div className="v3-closing-end" aria-hidden="true">
          <div className="v3-closing-word">
            {WORD.split('').map((ch, i) => <span key={i}>{ch}</span>)}
          </div>
        </div>
      </div>
    </Scene>
  );
}
