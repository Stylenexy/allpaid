// The tin on stage. It reacts to what really happens in the jar:
// a coin drops in when a payment lands, and when the split is accepted one coin
// flies to each member, sized by that member's share, labelled with the amount.
import { useLayoutEffect, useRef, useState } from 'react';
import type { JarConfig } from '../lib/jar';
import type { JarSnapshot } from '../lib/engine';
import { bch, percent } from '../lib/format';

export function BigTin() {
  return (
    <svg viewBox="0 0 220 250" className="bigtin" aria-hidden="true">
      <defs>
        <linearGradient id="brass-metal" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#9c7420" />
          <stop offset="0.18" stopColor="#e3b341" />
          <stop offset="0.34" stopColor="#f0cd6a" />
          <stop offset="0.55" stopColor="#c9a227" />
          <stop offset="0.85" stopColor="#8a6418" />
          <stop offset="1" stopColor="#5e4410" />
        </linearGradient>
        <linearGradient id="brass-lid" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f4d47a" />
          <stop offset="1" stopColor="#b8892b" />
        </linearGradient>
      </defs>
      {/* shadow on the street */}
      <ellipse cx="110" cy="236" rx="92" ry="11" fill="#000" opacity="0.45" />
      {/* body */}
      <path d="M28 64 V214 A82 20 0 0 0 192 214 V64 Z" fill="url(#brass-metal)" />
      {/* rims */}
      <path d="M28 96 A82 20 0 0 0 192 96 V104 A82 20 0 0 1 28 104 Z" fill="#6f5013" opacity="0.85" />
      <path d="M28 186 A82 20 0 0 0 192 186 V194 A82 20 0 0 1 28 194 Z" fill="#6f5013" opacity="0.85" />
      {/* paper label */}
      <path d="M28 122 A82 20 0 0 0 192 122 V160 A82 20 0 0 1 28 160 Z" fill="#f3ebdd" />
      <path d="M28 122 A82 20 0 0 0 192 122 V127 A82 20 0 0 1 28 127 Z" fill="#e9dfcc" />
      <text x="110" y="156" textAnchor="middle" className="bigtin-word">
        kencleng
      </text>
      {/* lid */}
      <ellipse cx="110" cy="64" rx="82" ry="20" fill="url(#brass-lid)" stroke="#8a6418" strokeWidth="3" />
      <ellipse cx="110" cy="64" rx="66" ry="14" fill="none" stroke="#8a6418" strokeWidth="1.5" opacity="0.6" />
      {/* coin slot */}
      <rect x="80" y="58" width="60" height="11" rx="5.5" fill="#0b1018" />
    </svg>
  );
}

export function TinStage({
  config,
  snap,
  compact = false,
}: {
  config: JarConfig;
  snap: JarSnapshot;
  compact?: boolean;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const tin = useRef<HTMLDivElement>(null);
  const slots = useRef<(HTMLLIElement | null)[]>([]);
  const [paths, setPaths] = useState<{ x: number; y: number }[]>([]);
  const payments = snap.events.filter((e) => e.kind === 'in').length;
  const refused = snap.events.filter((e) => e.kind === 'cheat').length;
  const last = snap.lastSplit;

  // Measure where each member's coin starts (the tin's slot) relative to where it lands.
  useLayoutEffect(() => {
    const measure = () => {
      const t = tin.current?.getBoundingClientRect();
      if (!t) return;
      setPaths(
        slots.current.map((s) => {
          const r = s?.querySelector('.slot-coin')?.getBoundingClientRect();
          if (!r) return { x: 0, y: 0 };
          return { x: t.left + t.width / 2 - (r.left + r.width / 2), y: t.top + t.height * 0.28 - (r.top + r.height / 2) };
        }),
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (stage.current) ro.observe(stage.current);
    return () => ro.disconnect();
  }, [config.members.length]);

  return (
    <div className={`stage ${compact ? 'stage-compact' : ''}`} ref={stage}>
      <div className="stage-tin" ref={tin}>
        {payments > 0 && <span key={`drop-${payments}`} className="drop-coin" aria-hidden="true" />}
        <div key={`shake-${payments}-${refused}`} className={payments > 0 ? 'tin-shake' : ''}>
          <BigTin />
        </div>
        {refused > 0 && (
          <span key={`ref-${refused}`} className="tin-refused" aria-hidden="true">
            Refused
          </span>
        )}
      </div>
      <ol className="slots" aria-label="Each member's last payout" style={{ '--n': config.members.length } as React.CSSProperties}>
        {config.members.map((m, i) => {
          const amount = last?.amounts?.[i];
          const size = 26 + Math.round(34 * Math.sqrt(m.bps / 10000));
          const p = paths[i] ?? { x: 0, y: -120 };
          return (
            <li key={i} ref={(el) => void (slots.current[i] = el)} className={`slot ${amount ? 'is-paid' : ''}`}>
              <span className="slot-hole" style={{ width: size, height: size }}>
                {amount && (
                  <span
                    key={`coin-${snap.splitCount}`}
                    className="slot-coin fly"
                    style={
                      {
                        width: size,
                        height: size,
                        '--fx': `${p.x}px`,
                        '--fy': `${p.y}px`,
                        animationDelay: `${i * 170}ms`,
                      } as React.CSSProperties
                    }
                  />
                )}
                {!amount && <span className="slot-coin ghost" style={{ width: size, height: size }} />}
              </span>
              <span className="slot-name">{m.name}</span>
              <span className="slot-amt num" aria-live="polite">
                {amount ? `+${bch(amount)}` : percent(m.bps)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
