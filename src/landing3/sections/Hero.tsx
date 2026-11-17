// Hero (Moto's product on a plinth): a vast dark stone hall, a shaft of light on
// the tin. On arrival one coin drops into the slot (a payment); the room breathes
// slowly; scrolling pushes in toward the tin while the light gathers, then the
// hall darkens into the next scene.
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Caps, Lede, Pill, Scene, useMotion } from '../kit';
import { gsap } from '../motion3';
import { PRELOADER_DONE } from './Preloader';
import './hero.css';

const WALL = { src: '/v3/wall-hero.webp', ratio: 1914 / 822, alt: 'A vast dark stone hall; a shaft of light falls on a small steel tip tin standing on a granite plinth' };
const FALLBACK = { src: '/v3/hero-plinth.webp', ratio: 1672 / 941, alt: 'A brushed-steel tip tin standing on a black granite plinth in a dark stone room' };
// Dust in the light: fixed positions so every visit looks the same.
const MOTES = [
  [66, 8, 11], [70, 14, 14], [63, 20, 12], [68, 26, 16], [61, 32, 13], [65, 38, 15],
  [58, 44, 12], [62, 50, 14], [56, 56, 11], [60, 60, 13], [69, 18, 15], [64, 30, 12],
] as const;

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  const pic = fallback ? FALLBACK : WALL;

  // The site bar sits above the hero; the hero fills exactly what is left of the first screen.
  useLayoutEffect(() => {
    const scene = ref.current?.closest('section');
    if (!scene) return;
    const fit = () => {
      const top = Math.max(0, scene.getBoundingClientRect().top + scrollY);
      // If the site's nav floats over the hero, keep the headline clear of it.
      const nav = document.querySelector('header.nav');
      const over = nav ? Math.max(0, nav.getBoundingClientRect().bottom + scrollY - top) : 0;
      scene.style.setProperty('--v3-hero-top', `${top}px`);
      scene.style.setProperty('--v3-hero-nav', `${Math.min(over, 160)}px`);
    };
    fit();
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  }, []);

  useMotion(
    ref,
    (reduced, el) => {
      if (reduced) return;
      const scene = el.closest('section') ?? el;
      const plate = el.querySelector<HTMLElement>('.v3-hero-plate')!;

      // Scrolling: a slow push-in toward the tin, the light gathering, then the hall goes dark.
      gsap
        .timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: scene, start: 0, end: 'bottom top', scrub: true } })
        .to(plate, { scale: 1.12 }, 0)
        .to('.v3-hero-media', { yPercent: 18 }, 0)
        .fromTo('.v3-hero-shaft', { opacity: 0.35 }, { opacity: 1 }, 0)
        .to('.v3-hero-copy', { yPercent: -30, autoAlpha: 0, duration: 0.6 }, 0)
        .to('.v3-hero-actions', { y: -40, autoAlpha: 0, duration: 0.45 }, 0)
        .to('.v3-hero-line', { autoAlpha: 0, duration: 0.2 }, 0)
        .to('.v3-hero-dark', { opacity: 0.92, duration: 0.6 }, 0.4);

      // Idle: the room breathes, very slowly.
      gsap.to('.v3-hero-drift', { x: 10, y: -6, scale: 1.018, duration: 9, ease: 'sine.inOut', repeat: -1, yoyo: true });

      // Arriving: the hall settles, the headline rises, one coin drops into the slot.
      const own = gsap.context(() => {}, el);
      const enter = () =>
        own.add(() => {
          const lines = el.querySelectorAll('.v3-hero-title .v3-line');
          const fall = () => -plate.clientHeight * 0.22;
          gsap
            .timeline({ defaults: { ease: 'expo.out' } })
            .fromTo('.v3-hero-enter', { scale: 1.06 }, { scale: 1, duration: 2.8 }, 0)
            .fromTo(lines, { yPercent: 110 }, { yPercent: 0, duration: 1.2, stagger: 0.1, overwrite: true }, 0.15)
            .fromTo('.v3-hero-sub', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'power3.out' }, 0.45)
            .fromTo('.v3-hero-actions-in', { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'power3.out' }, 0.6)
            // The coin: falls through the light, turning, and is gone into the slot.
            .fromTo('.v3-hero-coin', { y: fall, scaleY: 1, opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' }, 1.0)
            .to('.v3-hero-coin', { y: 0, duration: 0.85, ease: 'power2.in' }, 1.0)
            .fromTo('.v3-hero-coin i', { rotationX: 0 }, { rotationX: 720, duration: 0.85, ease: 'power1.in' }, 1.0)
            .to('.v3-hero-coin', { scaleY: 0.1, opacity: 0, duration: 0.1, ease: 'power1.in' }, 1.85)
            .fromTo('.v3-hero-glint', { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.18, ease: 'power2.out' }, 1.86)
            .to('.v3-hero-glint', { opacity: 0, duration: 1, ease: 'power2.out' }, 2.04);
        });
      if (document.documentElement.dataset.v3Preloader === 'on') {
        // The curtain is down: hold the entrance until it lifts.
        gsap.set(['.v3-hero-sub', '.v3-hero-actions-in'], { autoAlpha: 0 });
        addEventListener(PRELOADER_DONE, enter, { once: true });
        return () => removeEventListener(PRELOADER_DONE, enter);
      }
      enter();
    },
    [fallback],
  );

  return (
    <Scene id="hero" className={`v3-hero ${fallback ? 'is-fallback' : ''}`}>
      <div ref={ref} className="v3-hero-stage">
        <div className="v3-hero-media">
          <div className="v3-hero-plate" style={{ '--v3-hero-ratio': pic.ratio } as CSSProperties}>
            <div className="v3-hero-enter">
              <div className="v3-hero-drift">
                <picture>
                  <source
                    type="image/avif"
                    srcSet={`${pic.src.replace('.webp', '-md.avif')} 1280w, ${pic.src.replace('.webp', '-xl.avif')} 2560w`}
                    sizes="(orientation: portrait) 240vh, 100vw"
                  />
                  <img className="v3-hero-img" src={pic.src} alt={pic.alt} decoding="async" fetchPriority="high" onError={() => !fallback && setFallback(true)} />
                </picture>
                {!fallback && (
                  <>
                    <div className="v3-hero-shaft" aria-hidden="true">
                      <i className="v3-hero-beam" />
                      <div className="v3-hero-motes">
                        {MOTES.map(([x, y, d], i) => (
                          <span key={i} style={{ left: `${x}%`, top: `${y}%`, animationDuration: `${d}s`, animationDelay: `${-i * 1.7}s` }} />
                        ))}
                      </div>
                    </div>
                    <span className="v3-hero-coin" aria-hidden="true"><i /></span>
                    <span className="v3-hero-glint" aria-hidden="true" />
                  </>
                )}
                <div className="v3-hero-tin" data-cursor="coin" aria-hidden="true" />
              </div>
            </div>
          </div>
          <div className="v3-hero-dark" />
        </div>
        <div className="v3-hero-copy">
          <Caps as="h1" className="v3-hero-title">
            One QR.
            <br />
            Everyone gets paid.
          </Caps>
          <div className="v3-hero-sub">
            <Lede className="v3-hero-lede is-center">One Bitcoin Cash address that pays your whole team, in shares a covenant locks.</Lede>
          </div>
        </div>
        <div className="v3-hero-actions">
          <div className="v3-hero-actions-in">
            <div className="v3-actions is-center">
              <Pill href="/try" tone="money" cursor="split">Try it with play money</Pill>
              <Pill href="/new" tone="light">Make your team&rsquo;s jar</Pill>
            </div>
          </div>
        </div>
        <span className="v3-hero-line" aria-hidden="true"><i /></span>
      </div>
    </Scene>
  );
}
