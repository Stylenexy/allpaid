// The play-money jar that runs on the landing page. One engine is shared by the
// hero tin and the cheat scene, so what you do in one shows up in the other.
import { useEffect, useRef, useState } from 'react';
import { useJar } from '../hooks/useJar';
import { SAMPLE_BAND } from '../lib/sample';
import { TinStage } from '../components/TinStage';
import { bch, sats, shortHash } from '../lib/format';
import { SPLIT_FEE } from '../lib/jar';
import { onLinkClick } from '../router';

const DROP = 100_000n;

let shared: ReturnType<typeof useJar> | null = null;
function useSharedJar() {
  const jar = useJar(SAMPLE_BAND);
  shared = jar;
  return jar;
}

export default function HeroDemo() {
  const { engine, snap } = useSharedJar();
  const auto = useRef(false);
  const [busy, setBusy] = useState(false);

  // The story plays once by itself when the page opens, so the first look already shows a split.
  useEffect(() => {
    if (snap.status !== 'watching' || auto.current) return;
    auto.current = true;
    const t = setTimeout(() => engine.simulatePayment(DROP), 900);
    return () => clearTimeout(t);
  }, [snap.status, engine]);

  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setBusy(false), 1400);
    return () => clearTimeout(t);
  }, [busy, snap.splitCount]);

  const last = snap.lastSplit;
  return (
    <div className="hero-demo">
      <TinStage config={SAMPLE_BAND} snap={snap} />
      <div className="hero-demo-foot">
        <button
          type="button"
          className="btn btn-money"
          disabled={snap.status !== 'watching' || busy}
          onClick={() => {
            setBusy(true);
            engine.simulatePayment(DROP);
          }}
        >
          Drop {bch(DROP)} BCH into the tin
        </button>
        <a className="hero-demo-more" href="/try" onClick={onLinkClick}>
          Open the full play-money jar
        </a>
      </div>
      <div className={`receipt ${last ? 'is-printed' : ''}`} key={snap.splitCount} aria-live="polite">
        {last ? (
          <>
            <p className="receipt-line">
              <span>Split by the contract</span>
              <span className="num">{last.amounts?.length} outputs</span>
            </p>
            <p className="receipt-line">
              <span>Fee from the tin</span>
              <span className="num">{sats(SPLIT_FEE)} sats</span>
            </p>
            <p className="receipt-line receipt-tx">
              <span>Transaction</span>
              <span className="mono">{shortHash(last.txid ?? '', 8, 6)}</span>
            </p>
            <p className="receipt-note">Play money. The real Kencleng contract built this split and the Bitcoin Cash VM accepted it, in this tab.</p>
          </>
        ) : (
          <p className="receipt-note">{snap.status === 'watching' ? 'The band just finished a song…' : 'Setting up the play-money network…'}</p>
        )}
      </div>
    </div>
  );
}

export function CheatDemo() {
  const jar = shared;
  const [, force] = useState(0);
  // The hero mounts first and owns the engine; this panel only borrows it.
  useEffect(() => {
    if (!jar) {
      const t = setInterval(() => shared && force((n) => n + 1), 300);
      return () => clearInterval(t);
    }
    return jar.engine.subscribe(() => force((n) => n + 1));
  }, [jar]);
  if (!shared) return <div className="cheat-demo is-loading">Loading the play-money network…</div>;
  const { engine } = shared;
  const snap = engine.getSnapshot();
  const lastCheat = snap.events.find((e) => e.kind === 'cheat');
  const first = SAMPLE_BAND.members[0].name;
  return (
    <div className="cheat-demo">
      <div className="thief-tx" aria-label="The thief's transaction">
        <p className="thief-row">
          <span>In</span>
          <span className="num">{bch(DROP)} BCH from the tin</span>
        </p>
        <p className="thief-row thief-out">
          <span>Out</span>
          <span className="num">
            {bch(DROP - SPLIT_FEE)} BCH, all to {first}
          </span>
        </p>
        <p className="thief-row thief-missing">
          <span>Out</span>
          <span>nothing for {SAMPLE_BAND.members[1].name}</span>
        </p>
        <p className="thief-row thief-missing">
          <span>Out</span>
          <span>nothing for {SAMPLE_BAND.members[2].name}</span>
        </p>
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
        <div className="stamp" role="status" key={lastCheat.id}>
          <p className="stamp-mark">Refused</p>
          <p className="stamp-who">The Bitcoin Cash VM said:</p>
          <p className="stamp-msg mono">{lastCheat.message}</p>
          <p className="stamp-after">Then the honest split went through, and the tin up there paid all three.</p>
        </div>
      ) : (
        <p className="hint">Nothing is checked on our side first. The transaction goes straight to the VM, the same rules a node runs.</p>
      )}
    </div>
  );
}
