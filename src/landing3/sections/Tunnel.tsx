// Tunnel (Moto's card in a tunnel of photos): the tin turns in the middle while
// the teams it could pay drift toward you out of the dark, then pass. Scale of
// use, told by scrolling: podcasts, festivals, angkringan, studios, bands, kitchens.
import { useEffect, useRef, useState } from 'react';
import { Caps, Photo, Pill, Scene, useMotion } from '../kit';
import { gsap, reducedMotion } from '../motion3';
import './tunnel.css';

const TEAMS = {
  podcast: 'Two microphones on a table in a dark podcast room',
  festival: 'A crowd in front of a lit festival stage at night',
  angkringan: 'An angkringan food cart on a Jogja street at night, the Tugu in the distance',
  studio: 'A recording corner with a microphone, a chair and an acoustic guitar',
  band: 'Street musicians playing a guitar and a hand drum at night',
  kitchen: 'Kitchen staff wiping down a steel counter',
} as const;
type Team = keyof typeof TEAMS;
/**
 * The tunnel wall: each photo sits at an angle around the tin and starts at a depth (px).
 * Every team appears twice, near and far, so the tunnel never runs empty. Band and kitchen stay small.
 */
const CARDS: { team: Team; a: number; z: number; rz: number }[] = [
  { team: 'podcast', a: 200, z: -450, rz: -3 },
  { team: 'festival', a: 335, z: -850, rz: 3 },
  { team: 'angkringan', a: 150, z: -1250, rz: 2 },
  { team: 'studio', a: 25, z: -1650, rz: -2 },
  { team: 'band', a: 255, z: -2050, rz: -4 },
  { team: 'kitchen', a: 95, z: -2450, rz: 4 },
  { team: 'festival', a: 185, z: -2850, rz: 2 },
  { team: 'podcast', a: 0, z: -3250, rz: -2 },
  { team: 'studio', a: 130, z: -3650, rz: 3 },
  { team: 'angkringan', a: 315, z: -4050, rz: -3 },
  { team: 'kitchen', a: 280, z: -4450, rz: 3 },
  { team: 'band', a: 60, z: -4850, rz: -3 },
];
const small = (t: Team) => t === 'band' || t === 'kitchen';
const TRAVEL = 5600;
const FRAMES = 72;
const frameUrl = (i: number) => `/v3/turn/turn_${String(i).padStart(4, '0')}.webp`;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Fade in from far away, fade out as a card passes the camera. */
const depthAlpha = (z: number) => clamp01((z + 3100) / 800) * clamp01((650 - z) / 500);

export function Tunnel() {
  const ref = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frames = useRef<HTMLImageElement[] | null>(null);
  const [turn, setTurn] = useState(false);
  const [near, setNear] = useState(false);

  // Look for the turntable only when the scene is close; fall back to the photo if it is not there.
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setNear(true), { rootMargin: '150% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near || reducedMotion()) return;
    let alive = true;
    const probe = new Image();
    probe.onload = () => {
      if (!alive) return;
      const list = Array.from({ length: FRAMES }, (_, i) => {
        if (i === 0) return probe;
        const img = new Image();
        img.decoding = 'async';
        img.src = frameUrl(i);
        return img;
      });
      frames.current = list;
      setTurn(true);
    };
    probe.src = frameUrl(0);
    return () => {
      alive = false;
    };
  }, [near]);

  // Keep the canvas sharp (DPR capped at 1.5).
  useEffect(() => {
    const c = canvas.current;
    if (!turn || !c) return;
    const size = () => {
      const r = c.getBoundingClientRect();
      const dpr = Math.min(1.5, devicePixelRatio || 1);
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      c.dataset.frame = '';
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(c);
    return () => ro.disconnect();
  }, [turn]);

  useMotion(
    ref,
    (reduced, el) => {
      const stage = el.querySelector<HTMLElement>('.v3-tunnel-stage')!;
      const cards = Array.from(el.querySelectorAll<HTMLElement>('.v3-tunnel-card'));
      const narrow = matchMedia('(max-width: 760px)').matches;

      const drawFrame = (p: number) => {
        const c = canvas.current;
        const list = frames.current;
        if (!c || !list) return;
        const i = Math.round(p * (FRAMES - 1)) % FRAMES;
        const img = list[i];
        if (!img.complete || !img.naturalWidth || c.dataset.frame === String(i)) return;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, c.width, c.height);
        const s = Math.min(c.width / img.naturalWidth, c.height / img.naturalHeight);
        const w = img.naturalWidth * s;
        const h = img.naturalHeight * s;
        ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
        c.dataset.frame = String(i);
      };

      // One function lays out the whole tunnel for a progress value.
      const layout = (p: number) => {
        const W = stage.clientWidth;
        const H = stage.clientHeight;
        const fadeAll = 1 - clamp01((p - 0.72) / 0.14);
        cards.forEach((card, k) => {
          const c = CARDS[k];
          const rad = (c.a * Math.PI) / 180;
          const z = c.z + p * TRAVEL;
          const x = Math.cos(rad) * W * (narrow ? 0.44 : 0.36);
          const y = -Math.sin(rad) * H * (narrow ? 0.36 : 0.34);
          // Cards lean in toward the tin, like the walls of a tunnel.
          const ry = -Math.cos(rad) * 16;
          const rx = -Math.sin(rad) * 10;
          card.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg) rotateZ(${c.rz}deg)`;
          card.style.opacity = (depthAlpha(z) * fadeAll).toFixed(3);
        });
        drawFrame(p);
      };

      const tin = el.querySelector('.v3-tunnel-tin');
      // How far the tin rises at the end, in px of the stage height (recomputed on refresh).
      const lift = () => ((narrow ? -15 : -17) / 100) * stage.clientHeight;
      if (reduced) {
        // Still frame: the tunnel mid-flight, the tin above its headline.
        layout(0);
        gsap.set(tin, { y: lift(), scale: 0.72 });
        gsap.set('.v3-tunnel-space', { y: lift() }); // the photos gather round the tin, clear of the headline
        return;
      }

      const lines = el.querySelectorAll('.v3-tunnel-title .v3-line');
      const proxy = { p: 0 };
      layout(0);
      gsap.set('.v3-tunnel-copy', { autoAlpha: 0 });
      gsap.set('.v3-tunnel-cta', { autoAlpha: 0, y: 16 });

      gsap
        .timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: stage, start: 'top top', end: '+=200%', pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true, onRefresh: () => layout(proxy.p) },
        })
        .to(proxy, { p: 1, duration: 1, onUpdate: () => layout(proxy.p) }, 0)
        // The tin turns slowly as the teams pass (a wobble when there is no turntable yet).
        .fromTo('.v3-tunnel-photo-tin', { rotateY: -16 }, { rotateY: 16, duration: 0.5, ease: 'sine.inOut' }, 0)
        .to('.v3-tunnel-photo-tin', { rotateY: 0, duration: 0.3, ease: 'sine.inOut' }, 0.5)
        .fromTo(tin, { scale: 0.92 }, { scale: 1, duration: 0.6, ease: 'sine.out' }, 0)
        // Then it rises to make room for the line it stands for.
        .to(tin, { y: lift, scale: 0.72, duration: 0.18, ease: 'power2.inOut' }, 0.68)
        .to('.v3-tunnel-copy', { autoAlpha: 1, duration: 0.02 }, 0.76)
        .fromTo(lines, { yPercent: 110 }, { yPercent: 0, duration: 0.1, stagger: 0.025, ease: 'power3.out', overwrite: true }, 0.76)
        .to('.v3-tunnel-cta', { autoAlpha: 1, y: 0, duration: 0.08, ease: 'power2.out' }, 0.88);
    },
    [],
  );

  return (
    <Scene id="tunnel" className="v3-tunnel">
      <div ref={ref} className="v3-tunnel-wrap">
        <div className="v3-tunnel-stage">
          <div className="v3-tunnel-space">
            {CARDS.map((c, i) => (
              <div key={i} className={`v3-tunnel-card ${small(c.team) ? 'is-small' : ''}`}>
                {/* Each team is described once; its second, farther card is decoration. */}
                <Photo name={`team-${c.team}`} alt={i < 6 ? TEAMS[c.team] : ''} className="v3-tunnel-photo" />
              </div>
            ))}
          </div>
          <div className={`v3-tunnel-tin ${turn ? 'has-turn' : ''}`} data-cursor="coin">
            <div className="v3-tunnel-photo-tin">
              <img src="/v3/hero-plinth.webp" alt="The steel tip tin, turning" loading="lazy" decoding="async" />
            </div>
            {turn && <canvas ref={canvas} className="v3-tunnel-canvas" role="img" aria-label="The steel tip tin, turning" />}
          </div>
          <div className="v3-tunnel-copy">
            <Caps className="v3-tunnel-title">
              One address.
              <br />
              Every kind of team.
            </Caps>
            <div className="v3-tunnel-cta">
              <div className="v3-actions is-center">
                <Pill href="/new" tone="light">Make your team&rsquo;s jar</Pill>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Scene>
  );
}
