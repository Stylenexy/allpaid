// The play-money jar that runs on the landing page. One engine is shared by the
// hero tree and the cheat scene, so what you do in one shows up in the other.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useJar } from '../hooks/useJar';
import { SAMPLE_BAND, SAMPLE_ROLES } from '../lib/sample';
import { SplitTree } from '../components/SplitTree';
import { Refusal } from '../components/JarParts';
import { bch } from '../lib/format';
import { SPLIT_FEE } from '../lib/jar';
import { onLinkClick } from '../router';
import type { JarEngine } from '../lib/engine';

const DROP = 100_000n;

// The hero owns the engine; the cheat scene borrows it once it exists.
let sharedEngine: JarEngine | null = null;
const waiters = new Set<() => void>();

export default function HeroDemo() {
  const { engine, snap } = useJar(SAMPLE_BAND);
  const auto = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sharedEngine = engine;
    waiters.forEach((w) => w());
  }, [engine]);

  // The story plays once by itself, so the first look already shows a split.
  useEffect(() => {
    if (snap.status !== 'watching' || auto.current) return;
    auto.current = true;
    const t = setTimeout(() => engine.simulatePayment(DROP), 800);
    return () => clearTimeout(t);
  }, [snap.status, engine]);

  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setBusy(false), 1200);
    return () => clearTimeout(t);
  }, [busy, snap.splitCount]);

  return (
    <div className="demo-card">
      <SplitTree config={SAMPLE_BAND} snap={snap} roles={SAMPLE_ROLES} />
      <div className="demo-foot">
        <button
          type="button"
          className="btn btn-money"
          disabled={snap.status !== 'watching' || busy}
          onClick={() => {
            setBusy(true);
            engine.simulatePayment(DROP);
          }}
        >
          Pay {bch(DROP)} BCH into the jar
        </button>
        <a href="/try" onClick={onLinkClick} className="demo-more">
          Open the full play-money jar
        </a>
      </div>
      <p className="demo-note">
        Play money in a network that lives in this tab. Each split is built by the real contract and accepted by the Bitcoin Cash VM.
      </p>
    </div>
  );
}

function useSharedEngine(): JarEngine | null {
  const [engine, setEngine] = useState(sharedEngine);
  useEffect(() => {
    if (engine) return;
    const w = () => setEngine(sharedEngine);
    waiters.add(w);
    w();
    return () => void waiters.delete(w);
  }, [engine]);
  return engine;
}

export function CheatDemo() {
  const engine = useSharedEngine();
  if (!engine) return <div className="demo-card is-loading">Loading the play-money network…</div>;
  return <CheatInner engine={engine} />;
}

function CheatInner({ engine }: { engine: JarEngine }) {
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const lastCheat = snap.events.find((e) => e.kind === 'cheat');
  const [first, ...others] = SAMPLE_BAND.members;
  return (
    <div className="demo-card">
      <div className="thief-tx" aria-label="The thief's transaction">
        <p className="thief-row">
          <span>In</span>
          <span className="num">{bch(DROP)} BCH from the jar</span>
        </p>
        <p className="thief-row thief-out">
          <span>Out</span>
          <span className="num">
            {bch(DROP - SPLIT_FEE)} BCH, all to {first.name}
          </span>
        </p>
        {others.map((m) => (
          <p className="thief-row thief-missing" key={m.name}>
            <span>Out</span>
            <span>nothing for {m.name}</span>
          </p>
        ))}
      </div>
      <button
        type="button"
        className="btn"
        disabled={snap.status !== 'watching' || snap.cheatArmed}
        onClick={() => {
          engine.armCheat();
          engine.simulatePayment(DROP);
        }}
      >
        Send the thief's transaction
      </button>
      {lastCheat ? (
        <Refusal event={lastCheat} sandbox key={lastCheat.id} after="Then the honest split went through: the tree above paid all seven wallets." />
      ) : (
        <p className="demo-note">Nothing is checked on our side first. The transaction goes straight to the VM, the same rules a node runs.</p>
      )}
    </div>
  );
}
