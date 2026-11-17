// Pieces of the jar page: the activity feed and the cheat scene.
import { useState } from 'react';
import type { JarConfig } from '../lib/jar';
import type { JarEngine, JarEvent, JarSnapshot } from '../lib/engine';
import { explorerTx, jarTree, type CheatKind } from '../lib/chain';
import { bch, sats, shortHash } from '../lib/format';

const LABEL: Record<JarEvent['kind'], string> = {
  in: 'Payment landed',
  split: 'Split',
  merge: 'Small payments joined',
  cheat: 'Cheat refused by the network',
  hold: 'Held in the jar',
  error: 'Something went wrong',
};

export function Activity({ config, snap }: { config: JarConfig; snap: JarSnapshot }) {
  if (snap.events.length === 0) {
    return (
      <div className="activity-empty">
        <p>Nothing has landed yet. Payments show up here within a couple of seconds, then split on their own.</p>
      </div>
    );
  }
  const names = new Map(jarTree(config).map((n) => [n.id, n.config.members.map((m) => m.name)]));
  return (
    <ol className="activity" aria-label="Jar activity" aria-live="polite">
      {snap.events.map((e) => {
        const link = e.txid ? explorerTx(config.net, e.txid) : null;
        const members = names.get(e.node) ?? [];
        return (
          <li key={e.id} className={`act act-${e.kind} ${e.depth > 0 ? 'act-nested' : ''}`}>
            <span className="act-dot" aria-hidden="true" />
            <div className="act-body">
              <p className="act-title">
                {LABEL[e.kind]}
                {(e.kind === 'split' || e.kind === 'in') && <span> · {e.jarName}</span>}
                {e.satoshis !== undefined && <span className="num"> · {bch(e.satoshis)} BCH</span>}
              </p>
              {e.kind === 'split' && e.amounts && (
                <p className="act-detail num">
                  {e.amounts.map((a, i) => `${members[i] ?? `#${i + 1}`} ${sats(a)}`).join(' · ')} sats
                  {e.ms !== undefined && ` · ${e.ms < 1000 ? `${e.ms} ms` : `${(e.ms / 1000).toFixed(1)} s`} after it landed`}
                  {e.byOther && ' · another device sent the same split first'}
                </p>
              )}
              {(e.kind === 'cheat' || e.kind === 'error' || e.kind === 'hold' || e.kind === 'merge') && e.message && (
                <p className={`act-detail ${e.kind === 'cheat' ? 'mono' : ''}`}>{e.message}</p>
              )}
              {e.txid &&
                (link ? (
                  <a className="act-link mono" href={link} target="_blank" rel="noreferrer">
                    {shortHash(e.txid, 10, 6)}
                  </a>
                ) : (
                  <span className="act-link mono">{shortHash(e.txid, 10, 6)}</span>
                ))}
            </div>
            <time className="act-time num">{new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
          </li>
        );
      })}
    </ol>
  );
}

/** The two cheats the thief can try, in the words the page uses. */
export const CHEATS: Record<CheatKind, { label: string; text: (first: string) => string }> = {
  all: {
    label: 'Everything to one member',
    text: (first) => `One output: the whole payment to ${first}, nothing for the others.`,
  },
  swap: {
    label: "Swap two members' amounts",
    text: () => 'Every member is paid and the total adds up, but two members trade amounts.',
  },
};

/** Pick which cheat the thief tries. */
export function CheatChoice({ kind, onChange, disabled }: { kind: CheatKind; onChange: (kind: CheatKind) => void; disabled?: boolean }) {
  return (
    <div className="seg cheat-choice" role="radiogroup" aria-label="Which cheat">
      {(Object.keys(CHEATS) as CheatKind[]).map((k) => (
        <button key={k} type="button" role="radio" aria-checked={kind === k} disabled={disabled} className={`seg-btn ${kind === k ? 'is-on' : ''}`} onClick={() => onChange(k)}>
          {CHEATS[k].label}
        </button>
      ))}
    </div>
  );
}

/** The refusal, as the network or the VM reported it, plus the contract rule that caught it. */
export function Refusal({ event, sandbox, after }: { event: JarEvent; sandbox: boolean; after?: string }) {
  return (
    <div className="refusal" role="status">
      <p className="refusal-mark">Refused</p>
      <p className="refusal-who">{sandbox ? 'The Bitcoin Cash VM (libauth, same rules as a node) said:' : 'The node said:'}</p>
      <p className="refusal-msg">{event.message}</p>
      {event.rule && (
        <p className="refusal-rule">
          The rule that caught it{event.line ? `, Allpaid.cash line ${event.line}` : ''}: <strong>{event.rule}</strong>
        </p>
      )}
      {event.code && (
        <pre className="refusal-code" aria-label={`Allpaid.cash line ${event.line ?? ''}`}>
          <span className="refusal-ln" aria-hidden="true">{event.line}</span>
          {/* The require's message on its own line, so the code wraps where a person would wrap it. */}
          <code>{event.code.replace(/, "/, ',\n    "')}</code>
        </pre>
      )}
      {after && <p className="refusal-after">{after}</p>}
    </div>
  );
}

export function CheatPanel({ config, snap, engine }: { config: JarConfig; snap: JarSnapshot; engine: JarEngine }) {
  const lastCheat = snap.events.find((e) => e.kind === 'cheat');
  const sandbox = config.net === 'sandbox';
  const first = config.members[0]?.name ?? 'member 1';
  // Swapping needs two members with different shares; with equal shares only the first cheat is offered.
  const canSwap = config.members.some((m) => m.bps !== config.members[0].bps);
  const [kind, setKind] = useState<CheatKind>('all');
  const chosen = canSwap ? kind : 'all';
  const run = () => {
    engine.armCheat(chosen);
    if (sandbox) engine.simulatePayment(100_000n);
  };
  return (
    <section className="cheat v3a-panel v3a-cheat" id="cheat" aria-labelledby="cheat-title" data-rise>
      <h2 id="cheat-title" className="cheat-title v3a-h2">
        Try to cheat
      </h2>
      <p className="cheat-text">
        The thief gets the first shot at the next payment: a transaction that spends the jar's coin and breaks the agreement. {CHEATS[chosen].text(first)} It is
        broadcast to the {sandbox ? 'in-browser Bitcoin Cash VM' : 'network'} as is, with no check on our side. Then the honest split runs.
      </p>
      {canSwap && <CheatChoice kind={chosen} onChange={setKind} disabled={snap.cheatArmed} />}
      <div className="cheat-row">
        {snap.cheatArmed ? (
          <>
            <span className="cheat-armed" role="status">
              Thief is waiting. {sandbox ? '' : 'Pay any amount into the jar.'}
            </span>
            <button type="button" className="v3a-textbtn" onClick={() => engine.disarmCheat()}>
              Call it off
            </button>
          </>
        ) : (
          <button type="button" className="v3-pill v3-pill--light" onClick={run} disabled={snap.status !== 'watching'}>
            {sandbox ? 'Pay 0.001 BCH and let the thief try first' : 'Let the thief try the next payment'}
          </button>
        )}
      </div>
      {lastCheat && <Refusal event={lastCheat} sandbox={sandbox} key={lastCheat.id} />}
    </section>
  );
}
