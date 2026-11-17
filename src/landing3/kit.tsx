// Shared building blocks for the V3 landing. Every section uses these, so the
// page reads as one system: walls (full-bleed photos), caps headlines that
// reveal line by line, pill buttons and glass chips.
import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { SplitText } from 'gsap/SplitText';
import { onLinkClick } from '../router';
import { gsap, reducedMotion, ScrollTrigger } from './motion3';

gsap.registerPlugin(SplitText);

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Run GSAP code scoped to a section. `build(reduced)` creates tweens and
 * ScrollTriggers; everything is reverted on unmount. With reduced motion the
 * callback still runs (reduced = true) so it can set final states.
 */
export function useMotion(ref: RefObject<HTMLElement | null>, build: (reduced: boolean, el: HTMLElement) => void, deps: unknown[] = []) {
  useIso(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => build(reducedMotion(), el), el);
    // Images and fonts change layout after mount.
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Full-bleed photographic wall: a picture with a small source for phones. */
export function Wall({ name, alt, className = '', priority = false, position = 'center' }: { name: string; alt: string; className?: string; priority?: boolean; position?: string }) {
  return (
    <picture className={`v3-wall ${className}`}>
      {/* Full-bleed: a portrait phone crops a wide photo, so pick by covered width, not screen width.
          AVIF first (sharper at a smaller size, 2560 px for large screens), WebP as the fallback. */}
      <source type="image/avif" srcSet={`/v3/${name}-md.avif 1280w, /v3/${name}-xl.avif 2560w`} sizes="(orientation: portrait) 240vh, 100vw" />
      <img
        src={`/v3/${name}.webp`}
        srcSet={`/v3/${name}-sm.webp 900w, /v3/${name}.webp 1920w`}
        sizes="(orientation: portrait) 240vh, 100vw"
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        style={{ objectPosition: position }}
        {...(priority ? { fetchPriority: 'high' as const } : {})}
      />
    </picture>
  );
}

/** A photo that is not full-bleed (objects, cards). */
export function Photo({ name, alt, className = '' }: { name: string; alt: string; className?: string }) {
  return (
    <picture className={className}>
      <source media="(max-width: 760px)" srcSet={`/v3/${name}-sm.webp`} />
      <img src={`/v3/${name}.webp`} alt={alt} loading="lazy" decoding="async" />
    </picture>
  );
}

/**
 * Caps headline that reveals line by line when it scrolls into view (Moto's
 * SplitText rhythm). Pass the lines as children separated by <br />.
 */
export function Caps({ children, as: Tag = 'h2', className = '', align = 'center', id }: { children: ReactNode; as?: 'h1' | 'h2' | 'h3'; className?: string; align?: 'center' | 'left' | 'right'; id?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useMotion(ref, (reduced, el) => {
    if (reduced) return;
    const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'v3-line' });
    gsap.from(split.lines, {
      yPercent: 110,
      duration: 1.1,
      ease: 'expo.out',
      stagger: 0.09,
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
  });
  return (
    <Tag ref={ref} id={id} className={`v3-caps v3-caps--${align} ${className}`}>
      {children}
    </Tag>
  );
}

/** Calm paragraph that fades up once. */
export function Lede({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useMotion(ref, (reduced, el) => {
    if (reduced) return;
    gsap.from(el, { autoAlpha: 0, y: 24, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
  return <p ref={ref} className={`v3-lede ${className}`}>{children}</p>;
}

/** Pill button (Moto's "Apply for Access"). Internal links use the router. */
export function Pill({ href, children, tone = 'light', cursor }: { href: string; children: ReactNode; tone?: 'light' | 'money' | 'ghost'; cursor?: 'coin' | 'split' }) {
  const external = /^https?:/.test(href);
  return (
    <a
      className={`v3-pill v3-pill--${tone}`}
      href={href}
      data-cursor={cursor}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : { onClick: onLinkClick })}
    >
      {children}
    </a>
  );
}

/** Glass status chip with a check (Moto's "Jet Booked"). */
export function Chip({ children, tone = 'money', className = '', style }: { children: ReactNode; tone?: 'money' | 'refused' | 'plain'; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`v3-chip v3-chip--${tone} ${className}`} style={style}>
      <svg viewBox="0 0 16 16" aria-hidden="true" className="v3-chip-icon">
        {tone === 'refused' ? (
          <path d="M5 5l6 6M11 5l-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        ) : (
          <path d="M4 8.5l2.5 2.5L12 5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        )}
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeOpacity=".45" />
      </svg>
      <span>{children}</span>
    </span>
  );
}

/** Section shell: full-height scene with an id for anchors. */
export function Scene({ id, tone = 'dark', className = '', children, labelledBy }: { id?: string; tone?: 'dark' | 'light'; className?: string; children: ReactNode; labelledBy?: string }) {
  return (
    <section id={id} className={`v3-scene v3-scene--${tone} ${className}`} aria-labelledby={labelledBy}>
      {children}
    </section>
  );
}
