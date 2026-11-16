// Pieces of the jar page: member cards, the activity feed and the cheat scene.
import type { JarConfig } from '../lib/jar';
import type { JarEngine, JarEvent, JarSnapshot } from '../lib/engine';
import { explorerTx } from '../lib/chain';
import { bch, percent, sats, shortAddress, shortHash } from '../lib/format';

export function MemberCards({ config, snap }: { config: JarConfig; snap: JarSnapshot }) {
  const last = snap.lastSplit;
  const link = last?.txid ? explorerTx(config.net, last.txid) : null;
  return (
    <ol className="members" aria-label="Members and their shares">
      {config.members.map((m, i) => {
        const got = last?.amounts?.[i];
        return (
          <li
            key={`${i}-${snap.splitCount}`}
            className={`member ${got ? 'is-paid' : ''}`}
            style={{ animationDelay: `${i * 170}ms` }}
          >
            <div className="member-top">
              <span className="member-name">{m.name}</span>
              <span className="member-share num">{percent(m.bps)}</span>
            </div>
            <div className="member-bar" aria-hidden="true">
              <span style={{ width: `${m.bps / 100}%` }} />
            </div>
            <p className="member-got num" aria-live="polite">
              {got ? (
                <>
                  <span className="member-plus">+{bch(got)} BCH</span>
                  {link ? (
                    <a href={link} target="_blank" rel="noreferrer" className="member-link">
                      see it on the explorer
                    </a>
                  ) : (
                    <span className="member-link">checked by the VM</span>
                  )}
                </>
              ) : (
                <span className="member-wait">Waiting for the next payment</span>
              )}
            </p>
            <p className="member-meta">
              <span className="mono" title={m.address}>
                {shortAddress(m.address)}
              </span>
              {snap.totals[i] > 0n && <span className="num"> · {bch(snap.totals[i])} BCH since you opened this page</span>}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

const LABEL: Record<JarEvent['kind'], string> = {
  in: 'Payment landed in the jar',
  split: 'Split to every member',
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
  return (
    <ol className="activity" aria-label="Jar activity" aria-live="polite">
      {snap.events.map((e) => {
        const link = e.txid ? explorerTx(config.net, e.txid) : null;
        return (
          <li key={e.id} className={`act act-${e.kind}`}>
            <span className="act-dot" aria-hidden="true" />
            <div className="act-body">
              <p className="act-title">
                {LABEL[e.kind]}
                {e.satoshis !== undefined && <span className="num"> · {bch(e.satoshis)} BCH</span>}
              </p>
              {e.kind === 'split' && e.amounts && (
                <p className="act-detail num">
                  {e.amounts.map((a, i) => `${config.members[i]?.name} ${sats(a)}`).join(' · ')} sats
                  {e.ms !== undefined && ` · ${(e.ms / 1000).toFixed(1)} s after it landed`}
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

export function CheatPanel({ config, snap, engine }: { config: JarConfig; snap: JarSnapshot; engine: JarEngine }) {
  const lastCheat = snap.events.find((e) => e.kind === 'cheat');
  const sandbox = config.net === 'sandbox';
  const first = config.members[0]?.name ?? 'member 1';
  const run = () => {
    engine.armCheat();
    if (sandbox) engine.simulatePayment(100_000n);
  };
  return (
    <section className="cheat" aria-labelledby="cheat-title">
      <h2 id="cheat-title" className="cheat-title">
        Try to cheat
      </h2>
      <p className="cheat-text">
        The thief gets the first shot at the next payment: a transaction that spends the jar's coin and sends all of it to {first}, the
        one who used to hold the tin. It is broadcast to the {sandbox ? 'in-browser Bitcoin Cash VM' : 'network'} as is, with no check
        on our side. Then the honest split runs.
      </p>
      <div className="cheat-row">
        {snap.cheatArmed ? (
          <>
            <span className="cheat-armed" role="status">
              Thief is waiting. {sandbox ? '' : 'Pay any amount into the jar.'}
            </span>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => engine.disarmCheat()}>
              Call it off
            </button>
          </>
        ) : (
          <button type="button" className="btn" onClick={run} disabled={snap.status !== 'watching'}>
            {sandbox ? 'Pay 0.001 and let the thief try first' : 'Let the thief try the next payment'}
          </button>
        )}
      </div>
      {lastCheat && (
        <div className="stamp" role="status">
          <p className="stamp-mark">Refused</p>
          <p className="stamp-who">{sandbox ? 'Bitcoin Cash VM (libauth, same rules as a node) said:' : 'The node said:'}</p>
          <p className="stamp-msg mono">{lastCheat.message}</p>
        </div>
      )}
    </section>
  );
}
