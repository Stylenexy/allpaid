// Constellation (Moto's globe with status chips): one payment drops into the
// band's tin and travels out along thin lines to seven wallets, two levels deep.
// Scrolling plays it; the pay button runs the real covenant on play money in
// this tab and replays the route with the amounts the contract actually paid.
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { JarEvent } from '../../lib/engine';
import { SAMPLE_SHAPE } from '../../lib/sample-shape';
import { Caps, Chip, Scene, Wall, useMotion } from '../kit';
import { gsap } from '../motion3';
import './constellation.css';

type Pt = { x: number; y: number };
type Anchor = 'right' | 'below' | 'above';

interface Layout {
  w: number;
  h: number;
  narrow: boolean;
  root: Pt;
  rootSize: number;
  crewSize: number;
  l1: Pt[];
  l2: Pt[];
  drop: number;
  at: Record<string, { p: Pt; a: Anchor }>;
}

const WIDE: Layout = (() => {
  const root = { x: 130, y: 300 };
  const l1 = [{ x: 520, y: 70 }, { x: 520, y: 190 }, { x: 520, y: 310 }, { x: 520, y: 450 }];
  const l2 = [{ x: 900, y: 340 }, { x: 900, y: 420 }, { x: 900, y: 500 }, { x: 900, y: 580 }];
  const crew = l1[3];
  return {
    w: 1200, h: 630, narrow: false, root, rootSize: 74, crewSize: 50, l1, l2, drop: 92,
    at: {
      in: { p: { x: root.x, y: root.y - 58 }, a: 'above' },
      feeRoot: { p: { x: root.x, y: root.y + 52 }, a: 'below' },
      m0: { p: { x: l1[0].x + 20, y: l1[0].y }, a: 'right' },
      m1: { p: { x: l1[1].x + 20, y: l1[1].y }, a: 'right' },
      m2: { p: { x: l1[2].x + 20, y: l1[2].y }, a: 'right' },
      m3: { p: { x: crew.x, y: crew.y + 34 }, a: 'below' },
      feeCrew: { p: { x: crew.x, y: crew.y + 78 }, a: 'below' },
      c0: { p: { x: l2[0].x + 20, y: l2[0].y }, a: 'right' },
      c1: { p: { x: l2[1].x + 20, y: l2[1].y }, a: 'right' },
      c2: { p: { x: l2[2].x + 20, y: l2[2].y }, a: 'right' },
      c3: { p: { x: l2[3].x + 20, y: l2[3].y }, a: 'right' },
    },
  };
})();

const NARROW: Layout = (() => {
  const root = { x: 34, y: 40 };
  const l1 = [{ x: 92, y: 140 }, { x: 92, y: 210 }, { x: 92, y: 280 }, { x: 92, y: 362 }];
  const l2 = [{ x: 150, y: 452 }, { x: 150, y: 522 }, { x: 150, y: 592 }, { x: 150, y: 662 }];
  const crew = l1[3];
  return {
    w: 360, h: 690, narrow: true, root, rootSize: 46, crewSize: 34, l1, l2, drop: 56,
    at: {
      in: { p: { x: root.x + 30, y: root.y - 4 }, a: 'right' },
      feeRoot: { p: { x: root.x + 30, y: root.y + 36 }, a: 'right' },
      m0: { p: { x: l1[0].x + 17, y: l1[0].y }, a: 'right' },
      m1: { p: { x: l1[1].x + 17, y: l1[1].y }, a: 'right' },
      m2: { p: { x: l1[2].x + 17, y: l1[2].y }, a: 'right' },
      m3: { p: { x: crew.x + 24, y: crew.y }, a: 'right' },
      feeCrew: { p: { x: crew.x + 24, y: crew.y + 38 }, a: 'right' },
      c0: { p: { x: l2[0].x + 17, y: l2[0].y }, a: 'right' },
      c1: { p: { x: l2[1].x + 17, y: l2[1].y }, a: 'right' },
      c2: { p: { x: l2[2].x + 17, y: l2[2].y }, a: 'right' },
      c3: { p: { x: l2[3].x + 17, y: l2[3].y }, a: 'right' },
    },
  };
})();

/** Eight routes: root to its four members, then the road crew's jar to its four. */
function routes(L: Layout) {
  const tin = (s: number) => s * 0.44;
  const crew = L.l1[3];
  const curve = (a: Pt, b: Pt) =>
    L.narrow
      ? `M${a.x} ${a.y} C${a.x} ${b.y} ${a.x} ${b.y} ${b.x} ${b.y}`
      : `M${a.x} ${a.y} C${(a.x + b.x) / 2} ${a.y} ${(a.x + b.x) / 2} ${b.y} ${b.x} ${b.y}`;
  const from1 = L.narrow ? { x: L.root.x, y: L.root.y + tin(L.rootSize) } : { x: L.root.x + tin(L.rootSize), y: L.root.y };
  const from2 = L.narrow ? { x: crew.x, y: crew.y + tin(L.crewSize) } : { x: crew.x + tin(L.crewSize), y: crew.y };
  return [
    ...L.l1.map((p, i) => curve(from1, { x: p.x - (i === 3 ? tin(L.crewSize) : 9), y: p.y })),
    ...L.l2.map((p) => curve(from2, { x: p.x - 9, y: p.y })),
  ];
}

// The real numbers for a 0.001 BCH payment (the contract pays exactly these; the live run proves it).
const DEFAULT_ROOT = [29_700n, 24_750n, 19_800n, 24_750n];
const DEFAULT_CREW = [9_500n, 5_937n, 4_750n, 3_563n];
const PAYMENT = 100_000n;
const sats = (n: bigint) => Number(n).toLocaleString('en-US');
const bch = (n: bigint) => `${Number(n) / 1e8} BCH`;
const sum = (a: bigint[]) => a.reduce((s, x) => s + x, 0n);

interface LiveSplit {
  paid: bigint;
  root: bigint[];
  crewIn: bigint;
  crew: bigint[];
  ms?: number;
  txid?: string;
  count: number;
}

function TinGlyph({ at, size, className }: { at: Pt; size: number; className: string }) {
  const s = size / 96;
  return (
    <g className={className} transform={`translate(${at.x - size / 2} ${at.y - size / 2}) scale(${s})`}>
      <circle className="v3-constellation-halo" cx="48" cy="50" r="60" />
      <path d="M19 24h58v49c0 10-58 10-58 0Z" />
      <ellipse cx="48" cy="24" rx="29" ry="9" />
      <path d="M38 23h20" className="v3-constellation-slot" />
    </g>
  );
}

/* The play-money engine loads only when the scene is near: it carries the Bitcoin Cash VM. */
interface LiveProps {
  onSplit: (s: LiveSplit) => void;
  takeQueued: () => boolean;
}
const LivePay = lazy(async () => {
  const [{ useJar }, { SAMPLE_BAND }] = await Promise.all([import('../../hooks/useJar'), import('../../lib/sample')]);
  function LivePayInner({ onSplit, takeQueued }: LiveProps) {
    const { engine, snap } = useJar(SAMPLE_BAND);
    const latest = useRef(snap);
    latest.current = snap;
    const pending = useRef(false);
    const ready = snap.status === 'watching';

    const pay = useCallback(() => {
      if (latest.current.status === 'watching') engine.simulatePayment(PAYMENT);
      else pending.current = true; // still starting: pay the moment it is ready
    }, [engine]);
    useEffect(() => {
      if (!ready) return;
      if (pending.current || takeQueued()) {
        pending.current = false;
        engine.simulatePayment(PAYMENT);
      }
    }, [ready, engine, takeQueued]);

    // Both splits (the band's, then the road crew's) land a few ms apart: wait for both, then replay.
    useEffect(() => {
      if (snap.splitCount === 0) return;
      const t = setTimeout(() => {
        const s = latest.current;
        const root: JarEvent | undefined = s.lastSplits['0'];
        const crew: JarEvent | undefined = s.lastSplits['0.3'];
        if (!root?.amounts) return;
        onSplit({
          paid: root.satoshis ?? PAYMENT,
          root: root.amounts,
          crewIn: crew?.satoshis ?? root.amounts[3],
          crew: crew?.amounts ?? DEFAULT_CREW,
          ms: root.ms,
          txid: root.txid,
          count: s.splitCount,
        });
      }, 220);
      return () => clearTimeout(t);
    }, [snap.splitCount, onSplit]);

    const last = snap.lastSplits['0'];
    const paidTimes = snap.events.filter((e) => e.kind === 'split' && e.node === '0').length;
    const status =
      snap.status === 'offline'
        ? 'The play-money network is resting. The full sandbox is at /try.'
        : last && paidTimes > 0
          ? `Paid ${paidTimes === 1 ? 'once' : `${paidTimes} times`} in this tab. Last split accepted in ${last.ms ?? 0} ms, tx ${last.txid?.slice(0, 8)}…`
          : '';
    return <PayControl onPay={pay} busy={!ready} status={status} />;
  }
  return { default: LivePayInner };
});

function PayControl({ onPay, busy, status }: { onPay: () => void; busy?: boolean; status?: string }) {
  return (
    <div className="v3-constellation-pay">
      <button type="button" className="v3-pill v3-pill--money v3-constellation-btn" data-cursor="split" aria-busy={busy || undefined} onClick={onPay}>
        Pay 0.001 BCH (play money)
      </button>
      <p className="v3-constellation-note">Real contract, checked by the Bitcoin Cash VM in this tab.</p>
      <p className="v3-constellation-status" aria-live="polite">{status}</p>
    </div>
  );
}

function useNarrow() {
  const q = '(max-width: 760px)';
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setNarrow(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return narrow;
}

export function Constellation() {
  const narrow = useNarrow();
  const L = narrow ? NARROW : WIDE;
  const paths = routes(L);
  const ref = useRef<HTMLDivElement>(null);
  const replay = useRef<(s: LiveSplit) => void>(() => {});
  const queued = useRef(false);
  const [near, setNear] = useState(false);
  const [split, setSplit] = useState<LiveSplit | null>(null);

  // Load the engine one screen before the scene arrives.
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '100% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  const onSplit = useCallback((s: LiveSplit) => {
    setSplit(s);
    replay.current(s);
  }, []);
  const takeQueued = useCallback(() => {
    const q = queued.current;
    queued.current = false;
    return q;
  }, []);

  useMotion(
    ref,
    (reduced, el) => {
      const q = <T extends Element>(s: string) => Array.from(el.querySelectorAll<T>(s));
      const lit = q<SVGPathElement>('.v3-constellation-lit');
      const len = lit.map((p) => p.getTotalLength());
      const coins = q<SVGCircleElement>('.v3-constellation-coin');
      const live = q<SVGCircleElement>('.v3-constellation-livecoin');
      const node = (i: number) => el.querySelector(`[data-node="${i}"]`);
      const chip = (k: string) => el.querySelector<HTMLElement>(`[data-chip="${k}"]`);
      const chipIn = (k: string) => el.querySelector(`[data-chip="${k}"] .v3-chip`);
      const place = (c: SVGCircleElement, i: number, t: number) => {
        const pt = lit[i].getPointAtLength(t * len[i]);
        c.setAttribute('cx', String(pt.x));
        c.setAttribute('cy', String(pt.y));
      };
      const keys = ['m0', 'm1', 'm2', 'm3', 'c0', 'c1', 'c2', 'c3'];
      [...coins, ...live].forEach((c) => (c.style.opacity = '0'));

      // The live replay: quick, time-based, on its own coins, so it never fights the scroll.
      const hit = (target: Element | null) => {
        if (!target) return;
        target.classList.remove('is-hit');
        void (target as HTMLElement).getBoundingClientRect();
        target.classList.add('is-hit');
      };
      let liveTl: ReturnType<typeof gsap.timeline> | undefined;
      replay.current = () => {
        el.classList.add('is-live');
        liveTl?.kill();
        liveTl = gsap.timeline();
        const travel = (i: number, at: number, dur: number) => {
          const p = { t: 0 };
          const c = live[i];
          liveTl!.to(
            p,
            {
              t: 1,
              duration: dur,
              ease: 'power2.inOut',
              onStart: () => void gsap.set(c, { opacity: 1 }),
              onUpdate: () => place(c, i, p.t),
              onComplete: () => {
                gsap.set(c, { opacity: 0 });
                hit(chip(keys[i]));
                hit(node(i));
              },
            },
            at,
          );
        };
        liveTl.add(() => {
          hit(chip('in'));
          hit(el.querySelector('.v3-constellation-tin.is-root'));
        }, 0);
        liveTl.add(() => hit(chip('feeRoot')), 0.3);
        for (let i = 0; i < 4; i++) travel(i, 0.25 + i * 0.05, 0.7);
        liveTl.add(() => {
          hit(chip('feeCrew'));
          hit(el.querySelector('.v3-constellation-tin.is-crew'));
        }, 1.05);
        for (let j = 0; j < 4; j++) travel(4 + j, 1.1 + j * 0.05, 0.65);
      };

      if (reduced) return; // Final state is the CSS default with reduced motion.

      lit.forEach((p, i) => gsap.set(p, { strokeDasharray: len[i], strokeDashoffset: len[i] }));
      gsap.set(q('.v3-constellation-at .v3-chip'), { autoAlpha: 0, y: 10, scale: 0.94 });
      gsap.set(q('[data-node]'), { opacity: 0.35 });
      gsap.set(q('.v3-constellation-tin'), { opacity: 0.4 });
      gsap.set('.v3-constellation-end', { autoAlpha: 0, y: 12 });

      const stage = el.querySelector('.v3-constellation-stage');
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: L.narrow
          ? { trigger: el.querySelector('.v3-constellation-map'), start: 'top 78%', end: 'bottom 62%', scrub: 0.8 }
          : { trigger: stage, start: 'top top', end: '+=180%', pin: true, scrub: 0.8, anticipatePin: 1 },
      });

      const show = (k: string, at: number) =>
        tl.to(chipIn(k), { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: 'power2.out' }, at);
      const travel = (i: number, at: number, dur: number) => {
        const p = { t: 0 };
        const c = coins[i];
        tl.to(
          p,
          {
            t: 1,
            duration: dur,
            ease: 'power1.inOut',
            onUpdate: () => {
              place(c, i, p.t);
              c.style.opacity = String(Math.min(1, p.t * 10, (1 - p.t) * 10));
              lit[i].style.strokeDashoffset = String(len[i] * (1 - p.t));
            },
          },
          at,
        );
        const end = at + dur;
        tl.to(node(i), { opacity: 1, duration: 0.25 }, end - 0.05);
        if (i !== 3) show(keys[i], end - 0.05);
      };

      // A payment drops into the band's tin.
      const drop = el.querySelector('.v3-constellation-drop');
      tl.to('.v3-constellation-tin.is-root', { opacity: 1, duration: 0.5 }, 0)
        .fromTo(drop, { attr: { cy: L.root.y - L.drop }, opacity: 0 }, { attr: { cy: L.root.y - 6 }, opacity: 1, duration: 0.7, ease: 'power2.in' }, 0)
        .to(drop, { opacity: 0, duration: 0.15 }, 0.7);
      show('in', 0.2);
      // One transaction, four outputs: the fee comes off, the shares leave together.
      show('feeRoot', 0.85);
      for (let i = 0; i < 4; i++) travel(i, 1.0 + i * 0.2, 1.6);
      // The road crew's share is a jar of its own: it splits again.
      tl.to('.v3-constellation-tin.is-crew', { opacity: 1, duration: 0.3 }, 3.15);
      show('m3', 3.2);
      show('feeCrew', 3.6);
      for (let j = 0; j < 4; j++) travel(4 + j, 4.0 + j * 0.2, 1.5);
      tl.to('.v3-constellation-end', { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 6.4);
      tl.to({}, { duration: 0.8 }, 7.0);
    },
    [narrow],
  );

  const root = split?.root ?? DEFAULT_ROOT;
  const crew = split?.crew ?? DEFAULT_CREW;
  const paid = split?.paid ?? PAYMENT;
  const crewIn = split?.crewIn ?? root[3];
  const names = SAMPLE_SHAPE.members.map((m) => m.name);
  const crewNames = SAMPLE_SHAPE.members[3].jar?.members.map((m) => m.name) ?? [];
  const chips: Record<string, ReactNode> = {
    in: <Chip>{bch(paid)} in</Chip>,
    feeRoot: <Chip tone="plain">Fee {sats(paid - sum(root))} sats</Chip>,
    m0: <Chip>{names[0]} +{sats(root[0])} sats</Chip>,
    m1: <Chip>{names[1]} +{sats(root[1])} sats</Chip>,
    m2: <Chip>{names[2]} +{sats(root[2])} sats</Chip>,
    m3: <Chip>{names[3]} splits again</Chip>,
    feeCrew: <Chip tone="plain">Fee {sats(crewIn - sum(crew))} sats</Chip>,
    c0: <Chip>{crewNames[0]} +{sats(crew[0])} sats</Chip>,
    c1: <Chip>{crewNames[1]} +{sats(crew[1])} sats</Chip>,
    c2: <Chip>{crewNames[2]} +{sats(crew[2])} sats</Chip>,
    c3: <Chip>{crewNames[3]} +{sats(crew[3])} sats</Chip>,
  };

  return (
    <Scene id="constellation" className="v3-constellation">
      <div ref={ref} className="v3-constellation-wrap">
        <div className="v3-constellation-stage">
          <Wall name="wall-haze" alt="" className="v3-constellation-wall" />
          <div className="v3-constellation-head">
            <Caps className="v3-constellation-title">
              One address for
              <br />
              how teams get paid
            </Caps>
          </div>
          <div className="v3-constellation-field">
          <div
            className="v3-constellation-map"
            style={{ aspectRatio: `${L.w} / ${L.h}`, '--v3-map-ratio': L.w / L.h } as CSSProperties}
            role="img"
            aria-label="One 0.001 BCH payment into the band's jar is split in one transaction to Vocals 29,700, Drums 24,750 and Sound 19,800 sats, and 24,750 sats to the road crew's own jar, which splits again to Manager 9,500, Stage 5,937, Driver 4,750 and Photos 3,563 sats. Each split pays a 1,000 sat fee."
          >
            <svg viewBox={`0 0 ${L.w} ${L.h}`} className="v3-constellation-svg" aria-hidden="true">
              <g className="v3-constellation-routes">
                {paths.map((d, i) => <path key={`b${i}`} d={d} className="v3-constellation-line" />)}
                {paths.map((d, i) => <path key={`l${i}`} d={d} className="v3-constellation-lit" />)}
              </g>
              {[...L.l1.slice(0, 3), ...L.l2].map((p, k) => {
                const i = k < 3 ? k : k + 1;
                return (
                  <g key={i} data-node={i} className="v3-constellation-node" transform={`translate(${p.x} ${p.y})`}>
                    <circle className="v3-constellation-ring" r="7" />
                    <circle className="v3-constellation-dot" r="3" />
                  </g>
                );
              })}
              <g data-node="3">
                <TinGlyph at={L.l1[3]} size={L.crewSize} className="v3-constellation-tin is-crew" />
              </g>
              <TinGlyph at={L.root} size={L.rootSize} className="v3-constellation-tin is-root" />
              <circle className="v3-constellation-drop" cx={L.root.x} cy={L.root.y - L.drop} r={L.narrow ? 4 : 5} />
              {paths.map((_, i) => <circle key={`c${i}`} className="v3-constellation-coin" r={L.narrow ? 4 : 5} cx={-20} cy={-20} />)}
              {paths.map((_, i) => <circle key={`v${i}`} className="v3-constellation-livecoin" r={L.narrow ? 4 : 5} cx={-20} cy={-20} />)}
            </svg>
            {Object.entries(L.at).map(([k, { p, a }]) => (
              <span key={k} data-chip={k} className={`v3-constellation-at is-${a}`} style={{ left: `${(p.x / L.w) * 100}%`, top: `${(p.y / L.h) * 100}%` }}>
                {chips[k]}
              </span>
            ))}
          </div>
          </div>
          <div className="v3-constellation-foot">
            <p className="v3-constellation-end">1 payment · 2 levels · 7 wallets · 2 transactions</p>
            <Suspense fallback={<PayControl onPay={() => { queued.current = true; setNear(true); }} busy />}>
              {near ? (
                <LivePay onSplit={onSplit} takeQueued={takeQueued} />
              ) : (
                <PayControl onPay={() => { queued.current = true; setNear(true); }} busy />
              )}
            </Suspense>
          </div>
        </div>
      </div>
    </Scene>
  );
}
