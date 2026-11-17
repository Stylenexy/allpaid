// The play-money jar that runs on the landing page. One engine is shared by the
// hero tree and the cheat scene, so what you do in one shows up in the other.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useJar } from '../hooks/useJar';
import { SAMPLE_BAND, SAMPLE_ROLES } from '../lib/sample';
import { SplitTree } from '../components/SplitTree';
import { Refusal } from '../components/JarParts';
import { bch } from '../lib/format';
import { SPLIT_FEE } from '../lib/jar';
import { onLinkClick } from '../router';
import type { JarEngine } from '../lib/engine';
import { PaymentRoutes } from './PaymentRoutes';
import { cheatResult } from './cheat-result';
import { TinMark } from '../components/TinMark';

const DROP = 100_000n;

// The hero owns the engine; the cheat scene borrows it once it exists.
let sharedEngine: JarEngine | null = null;
const waiters = new Set<() => void>();

export default function HeroDemo() {
  const { engine, snap } = useJar(SAMPLE_BAND);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sharedEngine = engine;
    waiters.forEach((w) => w());
    return () => { if (sharedEngine === engine) sharedEngine = null; };
  }, [engine]);

  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setBusy(false), 1200);
    return () => clearTimeout(t);
  }, [busy, snap.splitCount]);

  return (
    <div className="demo-card">
      <PaymentRoutes snap={snap} />
      <div className="demo-ledger"><SplitTree config={SAMPLE_BAND} snap={snap} roles={SAMPLE_ROLES} /></div>
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
          Simulate {bch(DROP)} BCH
        </button>
        <a href="/try" onClick={onLinkClick} className="demo-more">
          Open the full play-money jar
        </a>
      </div>
      <p className="demo-note">
        Play money. Every split runs the real contract in this tab's Bitcoin Cash VM.
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
  const { refusal: lastCheat, honest } = cheatResult(snap.events);
  const [first, ...others] = SAMPLE_BAND.members;
  return (
    <div className="demo-card">
      <svg key={lastCheat?.id ?? 'ready'} className={`cheat-world ${lastCheat ? 'is-refused' : ''} ${honest ? 'is-honest' : ''}`} viewBox="0 0 360 170" role="img" aria-label={lastCheat ? `The slot is locked. The thief's route is broken.${honest ? ' The honest split was accepted by the VM.' : ' Waiting for the honest split.'}` : 'The jar holds the agreed routes. Try sending a transaction that breaks the agreement.'}>
        <path className="cheat-thief-route" pathLength="1" d="M180 74v30q0 12 70 12h72" />
        <path className="cheat-honest-route" pathLength="1" d="M180 74v40q0 16-95 16H34m146-56v82m0-82v40q0 16 85 16h61" />
        <g className="cheat-vessel" transform="translate(142 0)"><TinMark size={76} /></g>
        <path className="cheat-slot" d="M170 18h20" />
        <path className="cheat-lock" d="M171 55v-8a9 9 0 0 1 18 0v8m-20 0h22v18h-22Z" />
        <text className="cheat-route-label" x="320" y="102" textAnchor="end">Thief</text>
      </svg>
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
        <Refusal event={lastCheat} sandbox key={lastCheat.id} after={honest ? 'Then the honest split went through: the tree above paid all seven wallets.' : 'The thief was refused. Waiting for the honest split.'} />
      ) : (
        <p className="demo-note">Nothing is checked on our side first. The transaction goes straight to the VM, the same rules a node runs.</p>
      )}
    </div>
  );
}
