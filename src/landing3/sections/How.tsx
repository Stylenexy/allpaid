// How: the white set where one coin stream splits into four tins, then the
// real numbers of one payment drawn as a waterfall. Scrolling pulls the
// camera back from the single stream to reveal the four tins (one payment
// becomes four), and the money flow draws itself as you read down:
// 100,000 sats -> contract (fee) -> four members -> the road crew's own jar
// (fee) -> four more wallets. Every number is the sample band jar's real split.
import { useRef, type ReactNode } from 'react';
import { Caps, Scene, Wall, useMotion } from '../kit';
import { gsap } from '../motion3';
import './how.css';

const LEVEL1 = [
  { name: 'Vocals', sats: 29_700 },
  { name: 'Drums', sats: 24_750 },
  { name: 'Sound', sats: 19_800 },
  { name: 'Road crew', sats: 24_750 },
];
const LEVEL2 = [
  { name: 'Manager', sats: 9_500 },
  { name: 'Stage', sats: 5_937 },
  { name: 'Driver', sats: 4_750 },
  { name: 'Photos', sats: 3_563 },
];
const PAYMENT = 100_000;
const FEE = 1_000;

const fmt = (n: number) => n.toLocaleString('en-US');

const DESCRIPTION =
  'One payment of 0.001 BCH, 100,000 sats, enters the contract, which pays a 1,000 sat fee and splits the rest: Vocals 29,700, Drums 24,750, Sound 19,800 and Road crew 24,750 sats. ' +
  'The road crew is a jar of its own: it pays a 1,000 sat fee and splits again: Manager 9,500, Stage 5,937, Driver 4,750 and Photos 3,563 sats.';

/** The waterfall, laid out for a given width (wide for desktop, narrow for phones). */
function Flow({ narrow }: { narrow: boolean }) {
  const W = narrow ? 340 : 600;
  const H = 780;
  const cx = W / 2;
  const col = (i: number) => (W * (i + 0.5)) / 4;
  const T = 20; // stroke width of the whole 100,000 sat payment
  const width = (sats: number) => Math.max(1.4, (sats / PAYMENT) * T);
  const f = narrow ? { big: 26, small: 13, name: 13, amount: 15 } : { big: 30, small: 14, name: 15, amount: 17 };
  const slotHalf = narrow ? 46 : 64;
  const slot2Half = narrow ? 32 : 44;
  const y = { srcA: 36, srcB: 62, top: 86, slot1: 236, fan1: 380, foot1: 396, lab1a: 424, lab1b: 448, crew: 470, slot2: 556, fan2: 692, foot2: 708, lab2a: 736, lab2b: 760 };

  // Bands leave the slot stacked side by side, like a ribbon being cut.
  const fan = (items: { sats: number }[], from: number, fromY: number, toY: number, footY: number) => {
    const widths = items.map((m) => width(m.sats));
    const total = widths.reduce((a, b) => a + b, 0);
    let x = from - total / 2;
    return items.map((_, i) => {
      const sx = x + widths[i] / 2;
      x += widths[i];
      const dx = col(i);
      const bend = (toY - fromY) * 0.5;
      return { d: `M${sx.toFixed(2)} ${fromY} C${sx.toFixed(2)} ${fromY + bend} ${dx} ${toY - bend} ${dx} ${toY} V${footY}`, w: widths[i] };
    });
  };
  const fan1 = fan(LEVEL1, cx, y.slot1, y.fan1, y.foot1);
  const fan2 = fan(LEVEL2, cx, y.slot2, y.fan2, y.foot2);
  const crewX = col(3);
  const feeThread = (half: number, at: number) => `M${cx + half} ${at} C${cx + half + 16} ${at} ${cx + half + 18} ${at + 14} ${cx + half + 34} ${at + 14}`;

  const labels = (items: { name: string; sats: number }[], a: number, b: number, cls: string): ReactNode =>
    items.map((m, i) => (
      <g key={m.name} className={`v3-how-lab ${cls}`}>
        <text x={col(i)} y={a} textAnchor="middle" className="v3-how-t-name" fontSize={f.name}>{m.name}</text>
        <text x={col(i)} y={b} textAnchor="middle" className="v3-how-t-amount" fontSize={f.amount}>{fmt(m.sats)}</text>
      </g>
    ));

  return (
    <svg
      className={`v3-how-svg v3-how-svg--${narrow ? 'narrow' : 'wide'}`}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={DESCRIPTION}
    >
      <g className="v3-how-lab v3-how-src">
        <text x={cx} y={y.srcA} textAnchor="middle" className="v3-how-t-big" fontSize={f.big}>0.001 BCH</text>
        <text x={cx} y={y.srcB} textAnchor="middle" className="v3-how-t-soft" fontSize={f.small}>{fmt(PAYMENT)} sats</text>
      </g>

      {/* The payment falls into the contract's slot. */}
      <path className="v3-how-draw v3-how-money v3-how-trunk" d={`M${cx} ${y.top} V${y.slot1}`} strokeWidth={T} pathLength={1} />
      <path className="v3-how-draw v3-how-ink v3-how-slot1" d={`M${cx - slotHalf} ${y.slot1} H${cx + slotHalf}`} pathLength={1} />
      <g className="v3-how-lab v3-how-slot1-lab">
        <text x={cx - slotHalf - 10} y={y.slot1 + 4.5} textAnchor="end" className="v3-how-t-soft" fontSize={f.small}>Contract</text>
      </g>
      <path className="v3-how-draw v3-how-fee v3-how-fee1" d={feeThread(slotHalf, y.slot1)} pathLength={1} />
      <g className="v3-how-lab v3-how-fee1-lab">
        <text x={cx + slotHalf + 40} y={y.slot1 + 18.5} className="v3-how-t-soft" fontSize={f.small}>fee {fmt(FEE)}</text>
      </g>

      {/* Four members. */}
      {fan1.map((p, i) => (
        <path key={i} className="v3-how-draw v3-how-money v3-how-fan1" d={p.d} strokeWidth={p.w} pathLength={1} />
      ))}
      {labels(LEVEL1, y.lab1a, y.lab1b, 'v3-how-lab1')}

      {/* The road crew's share is a jar of its own: it falls again. */}
      <path
        className="v3-how-draw v3-how-money v3-how-crew"
        d={`M${crewX} ${y.crew} C${crewX} ${y.crew + 52} ${cx} ${y.slot2 - 52} ${cx} ${y.slot2}`}
        strokeWidth={width(LEVEL1[3].sats)}
        pathLength={1}
      />
      <path className="v3-how-draw v3-how-ink v3-how-slot2" d={`M${cx - slot2Half} ${y.slot2} H${cx + slot2Half}`} pathLength={1} />
      <g className="v3-how-lab v3-how-slot2-lab">
        <text x={cx - slot2Half - 10} y={y.slot2 + 4.5} textAnchor="end" className="v3-how-t-soft" fontSize={f.small}>Road crew jar</text>
      </g>
      <path className="v3-how-draw v3-how-fee v3-how-fee2" d={feeThread(slot2Half, y.slot2)} pathLength={1} />
      <g className="v3-how-lab v3-how-fee2-lab">
        <text x={cx + slot2Half + 40} y={y.slot2 + 18.5} className="v3-how-t-soft" fontSize={f.small}>fee {fmt(FEE)}</text>
      </g>

      {fan2.map((p, i) => (
        <path key={i} className="v3-how-draw v3-how-money v3-how-fan2" d={p.d} strokeWidth={p.w} pathLength={1} />
      ))}
      {labels(LEVEL2, y.lab2a, y.lab2b, 'v3-how-lab2')}
    </svg>
  );
}

export function How() {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(ref, (reduced, el) => {
    if (reduced) return;

    // Camera pulls back: one stream of coins, then the four tins it fills.
    const wall = el.querySelector('.v3-how-wall');
    gsap.fromTo(
      el.querySelector('.v3-how-wall .v3-wall'),
      { scale: 1.16, transformOrigin: '50% 62%' },
      { scale: 1, ease: 'none', scrollTrigger: { trigger: wall, start: 'top 85%', end: 'bottom 30%', scrub: 1.2 } },
    );

    // The three steps arrive in order.
    gsap.from(el.querySelectorAll('.v3-how-step'), {
      y: 40,
      autoAlpha: 0,
      duration: 1,
      ease: 'power3.out',
      stagger: 0.14,
      scrollTrigger: { trigger: el.querySelector('.v3-how-steps'), start: 'top 82%', once: true },
    });

    // The money draws itself down the waterfall as you scroll (both layouts;
    // only one is visible).
    el.querySelectorAll<SVGSVGElement>('.v3-how-svg').forEach((svg) => {
      const q = (s: string) => svg.querySelectorAll(s);
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: svg, start: 'top 78%', end: 'bottom 52%', scrub: 1.4 },
      });
      const draw = (s: string, at: number, duration: number) => tl.fromTo(q(s), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration }, at);
      const show = (s: string, at: number, stagger = 0) => tl.fromTo(q(s), { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger }, at);
      show('.v3-how-src', 0);
      draw('.v3-how-trunk', 0.1, 1.3);
      draw('.v3-how-slot1', 1.3, 0.4);
      show('.v3-how-slot1-lab', 1.3);
      draw('.v3-how-fee1', 1.7, 0.4);
      show('.v3-how-fee1-lab', 1.8);
      draw('.v3-how-fan1', 1.7, 1.6);
      show('.v3-how-lab1', 3.1, 0.08);
      draw('.v3-how-crew', 3.2, 1.4);
      draw('.v3-how-slot2', 4.55, 0.35);
      show('.v3-how-slot2-lab', 4.6);
      draw('.v3-how-fee2', 4.95, 0.4);
      show('.v3-how-fee2-lab', 5.05);
      draw('.v3-how-fan2', 5.0, 1.7);
      show('.v3-how-lab2', 6.35, 0.08);
      tl.to({}, { duration: 0.4 });
    });
  });

  return (
    <Scene id="how" tone="light" className="v3-how">
      <div ref={ref} className="v3-how-body">
        <div className="v3-how-wall">
          <Wall name="wall-split" alt="One stream of steel coins splitting in mid-air and falling into four steel tins of different sizes" />
        </div>
        <div className="v3-inner v3-how-inner">
          <Caps align="left" className="v3-how-title">
            Pay once.<br />Everyone is paid.
          </Caps>
          <div className="v3-how-grid">
            <ol className="v3-how-steps">
              <li className="v3-how-step"><span className="v3-how-n">1</span> Write the split.</li>
              <li className="v3-how-step"><span className="v3-how-n">2</span> Share one QR.</li>
              <li className="v3-how-step"><span className="v3-how-n">3</span> Every payment splits itself, in seconds.</li>
            </ol>
            <figure className="v3-how-figure">
              <Flow narrow={false} />
              <Flow narrow />
              <figcaption className="v3-how-caption">
                The sample band jar, in sats: 1 payment, 2 levels, 7 wallets, 2 transactions.
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </Scene>
  );
}
