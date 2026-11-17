// Rows: Moto's "Hotels / Dining / Travel" table, recast as the teams that
// already share a tin. Each row reveals as it scrolls in, and its share bar
// starts as one green line (one payment) that opens into the real shares
// (the split). On desktop, hovering a row floats that team's object near the
// pointer; on touch screens a small thumbnail sits in the row instead.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Caps, Photo, Scene, useMotion } from '../kit';
import { gsap, reducedMotion } from '../motion3';
import './rows.css';

const GREEN = '#0ac18e';
/** Same colour as .v3-rows-fill in rows.css, so clearing the tween is seamless. */
const INK = 'rgba(14, 16, 17, 0.86)';
const FINE = '(hover: hover) and (pointer: fine) and (min-width: 761px)';

type Share = { label: string; pct: number };
type Row = {
  name: string;
  text: string;
  photo: string;
  alt: string;
  bar: { kind: 'split'; shares: Share[] } | { kind: 'nested'; tiers: string[] } | { kind: 'equal'; count: number; caption: string };
};

const ROWS: Row[] = [
  {
    name: 'Street bands',
    text: 'One QR on the tin, and every tip is shared by the people who made the night.',
    photo: 'tin',
    alt: 'Brushed steel tip tin with a coin slot',
    bar: { kind: 'split', shares: [{ label: 'Vocals', pct: 30 }, { label: 'Drums', pct: 25 }, { label: 'Sound', pct: 20 }, { label: 'Road crew', pct: 25 }] },
  },
  {
    name: 'Multi-host podcasts',
    text: 'Listener support lands half and half, without one host holding it first.',
    photo: 'use-podcast',
    alt: 'Black podcast microphone on a boom arm',
    bar: { kind: 'split', shares: [{ label: 'Host A', pct: 50 }, { label: 'Host B', pct: 50 }] },
  },
  {
    name: 'Venue tip pools',
    text: 'The tip on the counter pays the floor, the bar and the kitchen at the same moment.',
    photo: 'use-venue',
    alt: 'Brass service bell beside a folded napkin',
    bar: { kind: 'split', shares: [{ label: 'Floor', pct: 40 }, { label: 'Bar', pct: 30 }, { label: 'Kitchen', pct: 30 }] },
  },
  {
    name: 'Festivals',
    text: 'One payment flows down nested jars, from the organiser to the band to the crew.',
    photo: 'use-festival',
    alt: 'Green festival wristband and a black guitar pick',
    bar: { kind: 'nested', tiers: ['Organiser', 'Band', 'Crew'] },
  },
  {
    name: 'Team campaigns',
    text: 'Every supporter’s payment is shared equally across the whole team.',
    photo: 'coins',
    alt: 'Silver coins floating in the air',
    bar: { kind: 'equal', count: 5, caption: 'Equal shares' },
  },
];

function Bar({ bar }: { bar: Row['bar'] }) {
  if (bar.kind === 'nested') {
    return (
      <div className="v3-rows-nest">
        {bar.tiers.map((t, i) => (
          <div key={t} className="v3-rows-tier" style={{ '--tier': i } as CSSProperties}>
            {i > 0 && <i className="v3-rows-drop" />}
            <i className="v3-rows-fill" />
            <span className="v3-rows-lab"><b>{t}</b></span>
          </div>
        ))}
      </div>
    );
  }
  if (bar.kind === 'equal') {
    return (
      <div className="v3-rows-share">
        <div className="v3-rows-bar">
          {Array.from({ length: bar.count }, (_, i) => (
            <span key={i} className="v3-rows-seg" style={{ flexGrow: 1 }}><i className="v3-rows-fill" /></span>
          ))}
        </div>
        <span className="v3-rows-lab"><b>{bar.caption}</b></span>
      </div>
    );
  }
  return (
    <div className="v3-rows-bar">
      {bar.shares.map((s) => (
        <span key={s.label} className="v3-rows-seg" style={{ flexGrow: s.pct }}>
          <i className="v3-rows-fill" />
          <span className="v3-rows-lab"><b>{s.label}</b><span>{s.pct}%</span></span>
        </span>
      ))}
    </div>
  );
}

export function Rows() {
  const ref = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);
  const [near, setNear] = useState(false);

  // Reveal rows one by one; each bar opens from one payment into its shares.
  useMotion(ref, (reduced, el) => {
    if (reduced) return;
    el.querySelectorAll<HTMLElement>('.v3-rows-row').forEach((row) => {
      const fills = row.querySelectorAll<HTMLElement>('.v3-rows-fill');
      const bars = row.querySelectorAll('.v3-rows-bar');
      const nested = row.querySelector('.v3-rows-nest') !== null;
      const tl = gsap.timeline({ scrollTrigger: { trigger: row, start: 'top 86%', once: true } });
      tl.from(row.querySelectorAll('.v3-rows-num, .v3-rows-name, .v3-rows-thumb, .v3-rows-text'), { y: 34, autoAlpha: 0, duration: 0.9, ease: 'power3.out', stagger: 0.06 });
      let split = 1.05;
      if (nested) {
        // Festivals: the payment drops tier by tier into the nested jars.
        let t = 0.3;
        row.querySelectorAll('.v3-rows-tier').forEach((tier) => {
          const drop = tier.querySelector('.v3-rows-drop');
          if (drop) {
            tl.fromTo(drop, { scaleY: 0 }, { scaleY: 1, duration: 0.25, ease: 'power1.in' }, t);
            t += 0.25;
          }
          tl.fromTo(tier.querySelector('.v3-rows-fill'), { scaleX: 0, backgroundColor: GREEN }, { scaleX: 1, backgroundColor: GREEN, duration: 0.45, ease: 'power2.out' }, t);
          t += 0.45;
        });
        split = t;
      } else {
        // One green line (one payment) sweeps across the whole bar ...
        const grow = [...fills].map((f) => Number.parseFloat((f.parentElement as HTMLElement).style.flexGrow) || 1);
        const total = grow.reduce((a, b) => a + b, 0);
        const sweep = 0.75;
        let at = 0;
        fills.forEach((f, i) => {
          const part = grow[i] / total;
          tl.fromTo(f, { scaleX: 0, backgroundColor: GREEN }, { scaleX: 1, backgroundColor: GREEN, duration: sweep * part, ease: 'none' }, 0.3 + sweep * at);
          at += part;
        });
        // ... then opens into the shares.
        tl.from(bars, { columnGap: 0, duration: 0.6, ease: 'power3.inOut' }, split);
      }
      tl.to(fills, { backgroundColor: INK, duration: 0.7, ease: 'power1.in', clearProps: 'backgroundColor' }, split + 0.1);
      tl.from(row.querySelectorAll('.v3-rows-lab'), { y: 8, autoAlpha: 0, duration: 0.6, ease: 'power3.out', stagger: 0.05 }, split + 0.1);
    });
  });

  // Desktop hover: the active row's object floats near the pointer.
  useEffect(() => {
    const float = floatRef.current;
    const list = ref.current?.querySelector<HTMLElement>('.v3-rows-list');
    if (!float || !list || !matchMedia(FINE).matches) return;
    // Load the floating photos only when the table comes close.
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); }
    }, { rootMargin: '600px 0px' });
    io.observe(list);
    const still = reducedMotion();
    const qx = gsap.quickTo(float, 'x', { duration: still ? 0 : 0.6, ease: 'power3.out' });
    const qy = gsap.quickTo(float, 'y', { duration: still ? 0 : 0.6, ease: 'power3.out' });
    const qr = gsap.quickTo(float, 'rotation', { duration: still ? 0 : 0.9, ease: 'power3.out' });
    let lastX = -1;
    let lastY = -1;
    let inside = false;
    const pick = () => {
      const hit = document.elementFromPoint(lastX, lastY)?.closest<HTMLElement>('[data-row]');
      setActive(hit && list.contains(hit) ? Number(hit.dataset.row) : -1);
    };
    const move = (e: PointerEvent) => {
      const first = lastX < 0;
      const dx = first ? 0 : e.clientX - lastX;
      lastX = e.clientX;
      lastY = e.clientY;
      if (first) gsap.set(float, { x: lastX, y: lastY });
      qx(lastX);
      qy(lastY);
      // A little swing in the direction of travel, like an object being carried.
      if (!still) qr(Math.max(-8, Math.min(8, dx * 0.4)));
      pick();
    };
    const enter = () => { inside = true; };
    const leave = () => { inside = false; setActive(-1); qr(0); };
    const scroll = () => { if (inside && lastX >= 0) pick(); };
    list.addEventListener('pointermove', move);
    list.addEventListener('pointerenter', enter);
    list.addEventListener('pointerleave', leave);
    addEventListener('scroll', scroll, { passive: true });
    return () => {
      io.disconnect();
      list.removeEventListener('pointermove', move);
      list.removeEventListener('pointerenter', enter);
      list.removeEventListener('pointerleave', leave);
      removeEventListener('scroll', scroll);
    };
  }, []);

  // Swap the floating object when the active row changes.
  useEffect(() => {
    const float = floatRef.current;
    if (!float) return;
    const still = reducedMotion();
    float.querySelectorAll<HTMLElement>('.v3-rows-float-img').forEach((img, i) => {
      if (i === active) gsap.fromTo(img, { autoAlpha: 0, scale: 0.86, yPercent: 8 }, { autoAlpha: 1, scale: 1, yPercent: 0, duration: still ? 0 : 0.55, ease: 'power3.out', overwrite: true });
      else gsap.to(img, { autoAlpha: 0, scale: 0.92, duration: still ? 0 : 0.3, ease: 'power2.out', overwrite: true });
    });
  }, [active, near]);

  return (
    <Scene id="rows" tone="light" className="v3-rows">
      <div ref={ref} className="v3-inner v3-rows-inner">
        <Caps align="left" className="v3-rows-title">
          Made for the teams<br />you already play in.
        </Caps>
        <ol className={`v3-rows-list${active >= 0 ? ' has-active' : ''}`}>
          {ROWS.map((r, i) => (
            <li key={r.name} className={`v3-rows-row${active === i ? ' is-active' : ''}`} data-row={i}>
              <span className="v3-rows-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <div className="v3-rows-head">
                <h3 className="v3-rows-name">{r.name}</h3>
                <Photo name={r.photo} alt={r.alt} className="v3-rows-thumb" />
              </div>
              <p className="v3-rows-text">{r.text}</p>
              <div className="v3-rows-cell">
                <Bar bar={r.bar} />
              </div>
            </li>
          ))}
        </ol>
        <div ref={floatRef} className="v3-rows-float" aria-hidden="true">
          {near && ROWS.map((r) => (
            <img key={r.photo} className="v3-rows-float-img" src={`/v3/${r.photo}.webp`} alt="" decoding="async" />
          ))}
        </div>
      </div>
    </Scene>
  );
}
