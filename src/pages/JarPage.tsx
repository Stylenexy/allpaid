import { useMemo, useState } from 'react';
import { decodeJar, encodeJar, levelCount, minPaymentFor, SPLIT_FEE, validateJar, walletCount, type JarConfig } from '../lib/jar';
import { explorerAddress } from '../lib/chain';
import { useJar } from '../hooks/useJar';
import { Activity, CheatPanel } from '../components/JarParts';
import { PayPanel } from '../components/PayPanel';
import { SplitTree } from '../components/SplitTree';
import { bch, percent, sats } from '../lib/format';
import { onLinkClick } from '../router';
import { SAMPLE_BAND } from '../lib/sample';
import { SITE } from '../site';

const NET_LABEL = {
  mainnet: 'Mainnet · real BCH',
  chipnet: 'Chipnet · test coins',
  sandbox: 'Sandbox · play money',
} as const;

export function JarRoute({ code, sandbox }: { code?: string; sandbox?: boolean }) {
  const config = useMemo<JarConfig | null>(() => (sandbox ? SAMPLE_BAND : code ? decodeJar(code) : null), [code, sandbox]);
  const problems = useMemo(() => (config ? validateJar(config) : []), [config]);
  if (!config || problems.length > 0) {
    return (
      <main className="wrap page-narrow">
        <h1 className="page-title">This jar link does not open</h1>
        <p className="lead">
          {config ? problems[0].message : 'The link is cut short or was changed. Ask whoever shared it to send the whole link again.'}
        </p>
        <p className="page-actions">
          <a className="btn btn-primary" href="/new" onClick={onLinkClick}>
            Make a new jar
          </a>
          <a className="btn" href="/try" onClick={onLinkClick}>
            Open the play-money jar
          </a>
        </p>
      </main>
    );
  }
  return <JarView config={config} />;
}

function JarView({ config }: { config: JarConfig }) {
  const { engine, snap, address } = useJar(config);
  const [shared, setShared] = useState(false);
  const shareLink = `${location.origin}/jar#${encodeJar(config)}`;
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: `${config.name} on Splitjar`, url: shareLink });
      else {
        await navigator.clipboard.writeText(shareLink);
        setShared(true);
        setTimeout(() => setShared(false), 1600);
      }
    } catch {
      /* user closed the share sheet */
    }
  };
  const addrLink = explorerAddress(config.net, address);
  const nested = config.members.some((m) => m.jar);

  return (
    <main className="jar wrap">
      <div className="jar-head">
        <div>
          <p className={`net net-${config.net}`}>{NET_LABEL[config.net]}</p>
          <h1 className="jar-name">{config.name}</h1>
          <p className="jar-sub">
            {config.members.length} members ·{' '}
            {config.members.map((m) => `${m.name}${m.jar ? ' (jar)' : ''} ${percent(m.bps)}`).join(', ')}
          </p>
        </div>
        <div className="jar-head-actions">
          <span className={`status status-${snap.status}`} role="status">
            {snap.status === 'watching' ? 'Watching the jar' : snap.status === 'connecting' ? 'Connecting…' : 'Offline, retrying'}
          </span>
          {config.net !== 'sandbox' && (
            <button type="button" className="btn btn-small" onClick={share}>
              {shared ? 'Link copied' : 'Share this jar'}
            </button>
          )}
        </div>
      </div>
      {snap.status === 'offline' && snap.statusMessage && <p className="problem jar-offline">{snap.statusMessage}</p>}

      <div className="jar-grid">
        <PayPanel config={config} snap={snap} engine={engine} />
        <div className="jar-side">
          <h2 className="side-title">Who gets what</h2>
          <SplitTree config={config} snap={snap} />
          <h2 className="side-title">What happened</h2>
          <Activity config={config} snap={snap} />
        </div>
      </div>

      <CheatPanel config={config} snap={snap} engine={engine} />

      <section className="rules" aria-labelledby="rules-title">
        <h2 id="rules-title" className="rules-title">
          What this jar's contract enforces
        </h2>
        <ul className="rules-list">
          <li>
            Every payment leaves in one transaction with exactly {config.members.length} outputs, one per member, in the shares above. The last
            member takes the rounding remainder, so no satoshi is lost.
          </li>
          <li>
            The network fee is fixed at <span className="num">{sats(SPLIT_FEE)}</span> sats per split and comes out of the payment, so
            anyone can press split without a wallet. Nobody can take more.
          </li>
          <li>
            The smallest payment it can split is <span className="num">{bch(minPaymentFor(config.members), 2)}</span> BCH (every wallet
            gets at least 1,000 sats{nested ? ', and every nested jar gets enough to split again' : ''}). Smaller payments wait in the jar until
            two of them can be joined.
          </li>
          {nested && (
            <li>
              A member that is itself a jar is paid like any other member: to its address. This page then splits that jar too, in its own
              transaction with its own {sats(SPLIT_FEE)}-sat fee. One payment here reaches {walletCount(config.members)} wallets over{' '}
              {levelCount(config.members)} levels.
            </li>
          )}
          <li>There is no owner key. The shares are part of the address itself: change one share and you get a different jar.</li>
        </ul>
        <p className="rules-addr">
          Jar address: <span className="mono">{address}</span>
          {addrLink && (
            <>
              {' '}
              <a href={addrLink} target="_blank" rel="noreferrer">
                open on the explorer
              </a>
            </>
          )}
        </p>
        <p className="hint">
          Source of the contract: <a href={`${SITE.repoUrl}/blob/main/contracts/Splitjar.cash`}>contracts/Splitjar.cash</a>. This page
          splits automatically while it is open; any copy of the link can do it too, and every copy builds the same transaction.
        </p>
      </section>
    </main>
  );
}
