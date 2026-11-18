// The automatic demo: one caption card and a visible cursor that walks through
// Allpaid the way a person would, pressing the real buttons. Started by the
// "Watch it run" buttons or a link with ?demo. Escape or the close button ends it.

import { useEffect, useRef, useState } from 'react';
import { navigate } from '../router';
import { Driver, Stopped } from './driver';
import { clearDemoFromUrl, resetPages } from './trigger';
import { CHAPTERS, STEPS } from './script';
import './demo.css';

type Phase = 'run' | 'end' | 'lost';

const PauseIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M5 3.5v9M11 3.5v9" />
  </svg>
);
const PlayIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M5 3.2l8 4.8-8 4.8z" className="fill" />
  </svg>
);
const CloseIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4.5 4.5l7 7m0-7l-7 7" />
  </svg>
);

export function AutoDemo({ onExit }: { onExit: () => void }) {
  const layer = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const ripple = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);
  const endButton = useRef<HTMLButtonElement>(null);
  const pausedRef = useRef(false);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('run');
  const [paused, setPaused] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (phase === 'end') endButton.current?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    // Keyboard focus moves to the card while the demo runs (the button that started it hides),
    // and goes back to that button when the demo closes.
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.documentElement;
    root.classList.add('demo-on');
    card.current?.focus({ preventScroll: true });
    // A reload or Back must not start the demo again.
    clearDemoFromUrl();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      root.classList.remove('demo-on');
      window.removeEventListener('keydown', onKey);
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, [onExit]);

  useEffect(() => {
    const parts = [layer.current, cursor.current, label.current, ring.current, ripple.current];
    if (parts.some((p) => !p)) return;
    const [layerEl, cursorEl, labelEl, ringEl, rippleEl] = parts as HTMLElement[];
    const controller = new AbortController();
    const driver = new Driver(
      {
        layer: layerEl,
        cursor: cursorEl,
        label: labelEl,
        ring: ringEl,
        ripple: rippleEl,
        freeBottom: () => card.current?.getBoundingClientRect().top ?? innerHeight,
      },
      controller.signal,
      () => pausedRef.current,
    );
    resetPages();
    (async () => {
      for (const [i, step] of STEPS.entries()) {
        setIndex(i);
        await step.run(driver);
        await driver.wait(450);
      }
      driver.hide();
      setPhase('end');
    })().catch((error: unknown) => {
      if (error instanceof Stopped || controller.signal.aborted) return;
      console.warn('[allpaid demo]', error);
      driver.hide();
      setPhase('lost');
    });
    return () => controller.abort();
  }, [round]);

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };
  const restart = () => {
    pausedRef.current = false;
    setPaused(false);
    setIndex(0);
    setPhase('run');
    setRound((r) => r + 1);
  };
  const makeOwn = () => {
    onExit();
    navigate('/new');
  };

  const step = STEPS[index];
  const running = phase === 'run';
  const progress = running ? ((index + 1) / STEPS.length) * 100 : 100;
  const title = phase === 'end' ? "That's Allpaid" : phase === 'lost' ? 'The demo lost its place' : step.title;
  const text =
    phase === 'end'
      ? 'One QR. Everyone gets paid, and nobody can take more than their share. Everything you saw ran in this tab: the contract, the split, the refusals.'
      : phase === 'lost'
        ? 'Something on the page did not show up in time. Run it again, or close it and try the page yourself.'
        : step.text;

  return (
    <div className="demo" data-demo-ui="">
      <div ref={layer} className="demo-layer" data-on="0" aria-hidden="true">
        <div ref={ring} className="demo-ring" data-on="0" />
        <div ref={ripple} className="demo-ripple" />
        <div ref={cursor} className="demo-cursor">
          <svg viewBox="0 0 26 30" aria-hidden="true" focusable="false">
            <path d="M3 2 L3 24 L8.6 18.6 L12.6 27.4 L16.4 25.7 L12.5 17 L20.5 17 Z" />
          </svg>
          <span ref={label} className="demo-label" />
        </div>
      </div>

      <section ref={card} tabIndex={-1} className={`demo-card ${paused ? 'is-paused' : ''}`} role="region" aria-label="Automatic demo">
        <span className="demo-bar" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </span>
        <div aria-live="polite">
          <h2 className="demo-title">{title}</h2>
          <p className="demo-text">{text}</p>
        </div>
        {running ? (
          <div className="demo-foot">
            <p className="demo-meta num">
              {paused ? 'Paused · ' : ''}
              {CHAPTERS[step.chapter]} · {index + 1} / {STEPS.length}
            </p>
            <button type="button" className="demo-icon" onClick={togglePause} aria-label={paused ? 'Resume the demo' : 'Pause the demo'} title={paused ? 'Resume' : 'Pause'}>
              {paused ? <PlayIcon /> : <PauseIcon />}
            </button>
            <button type="button" className="demo-icon" onClick={onExit} aria-label="Close the demo" title="Close (Esc)">
              <CloseIcon />
            </button>
          </div>
        ) : (
          <div className="demo-actions">
            {phase === 'end' && (
              <button ref={endButton} type="button" className="demo-btn demo-btn--money" onClick={makeOwn}>
                Make your team&rsquo;s jar
              </button>
            )}
            <button type="button" className="demo-btn" onClick={restart}>
              Watch again
            </button>
            <button type="button" className="demo-btn demo-btn--plain" onClick={onExit}>
              Close
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
