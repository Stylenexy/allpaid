import { useMemo, useRef, useState } from 'react';
import { decodeJar, encodeJar, levelCount, minPaymentFor, SPLIT_FEE, validateJar, walletCount, type JarConfig } from '../lib/jar';
import { explorerAddress, jarTree } from '../lib/chain';
import { useJar } from '../hooks/useJar';
import { Activity, CheatPanel } from '../components/JarParts';
import { PayPanel } from '../components/PayPanel';
import { SplitTree } from '../components/SplitTree';
import { bch, percent, sats } from '../lib/format';
import { SAMPLE_BAND } from '../lib/sample';
import { SITE } from '../site';
import { Logo } from '../components/TinMark';
import { Title, useRise, useStonePage } from '../components/AppV3';
import { Pill, Wall } from '../landing3/kit';

const NET_LABEL = {
  mainnet: 'Mainnet · real BCH',
  chipnet: 'Chipnet · test coins',
  sandbox: 'Sandbox · play money',
} as const;

export function JarRoute({ code, sandbox }: { code?: string; sandbox?: boolean }) {
  const config = useMemo<JarConfig | null>(() => (sandbox ? SAMPLE_BAND : code ? decodeJar(code) : null), [code, sandbox]);
  const problems = useMemo(() => (config ? validateJar(config) : []), [config]);
  if (!config || problems.length > 0) {
    return <JarMissing message={config ? problems[0].message : 'The link is cut short or was changed. Ask whoever shared it to send the whole link again.'} />;
  }
  return <JarView config={config} />;
}

function JarMissing({ message }: { message: string }) {
  const page = useRef<HTMLElement>(null);
  useStonePage();
  useRise(page);
  return (
    <main ref={page} className="v3 v3a v3a--missing">
      <header className="v3a-hero">
        <Wall name="wall-haze" alt="" priority className="v3a-hero-wall" />
        <div className="v3a-hero-in">
          <Title>This jar link does not open</Title>
          <p className="v3a-lede" data-rise>
            {message}
          </p>
          <div className="v3-actions" data-rise>
            <Pill href="/new" tone="light">
              Make a new jar
            </Pill>
            <Pill href="/try" tone="ghost">
              Open the play-money jar
            </Pill>
          </div>
        </div>
      </header>
    </main>
  );
}

function JarView({ config }: { config: JarConfig }) {
  const page = useRef<HTMLElement>(null);
  useStonePage();
  useRise(page);
  const { engine, snap, address } = useJar(config);
  const [shared, setShared] = useState(false);
  const shareLink = `${location.origin}/jar#${encodeJar(config)}`;
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: `${config.name} on Allpaid`, url: shareLink });
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
  const sandbox = config.net === 'sandbox';

  return (
    <main ref={page} className={`v3 v3a ${sandbox ? 'v3a--try jar-sandbox' : 'v3a--jar jar-live'}`}>
      <header className="v3a-hero">
        {/* Play money opens in the landing's hall, the tin under its shaft of light; a real jar in calm haze. */}
        <Wall name={sandbox ? 'wall-hero' : 'wall-haze'} alt="" priority className="v3a-hero-wall" position={sandbox ? '50% 64%' : '30% 50%'} />
        <div className="v3a-hero-in jar-head">
          <div className="v3a-hero-copy">
            <Title>{sandbox ? <>Pay once.<br />Seven wallets get paid.</> : config.name}</Title>
            <div className="v3a-meta" data-rise>
              <p className={`net net-${config.net}`}>{NET_LABEL[config.net]}{sandbox ? ` · ${config.name}` : ''}</p>
              <p className="jar-sub">
                {config.members.length} members ·{' '}
                {config.members.map((m) => `${m.name}${m.jar ? ' (jar)' : ''} ${percent(m.bps)}`).join(', ')}
              </p>
              <span className={`status status-${snap.status}`} role="status">
                <span className="status-mark" aria-hidden="true"><Logo size={18} /></span>
                {snap.status === 'watching' ? 'Watching the jar' : snap.status === 'connecting' ? 'Connecting…' : 'Offline, retrying'}
              </span>
            </div>
          </div>
          {!sandbox && (
            <div className="jar-head-actions" data-rise>
              <button type="button" className="v3-pill v3a-pill--quiet v3a-pill--sm" onClick={share}>
                {shared ? 'Link copied' : 'Share this jar'}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="v3a-body">
        {snap.status === 'offline' && snap.statusMessage && <p className="problem jar-offline">{snap.statusMessage}</p>}

        <div className="jar-grid">
          <PayPanel config={config} snap={snap} engine={engine} />
          <div className="jar-side">
            <div className="v3a-side-block" data-rise>
              <h2 className="side-title v3a-h3">Who gets what</h2>
              <SplitTree config={config} snap={snap} />
            </div>
            <div className="v3a-side-block" data-rise>
              <h2 className="side-title v3a-h3">What happened</h2>
              <Activity config={config} snap={snap} />
            </div>
          </div>
        </div>

        <CheatPanel config={config} snap={snap} engine={engine} />

        <section className="rules v3a-rules" aria-labelledby="rules-title" data-rise>
          <h2 id="rules-title" className="rules-title v3a-h2">
            What this jar's contract enforces
          </h2>
          <div className="v3a-rules-body">
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
                  Smallest payment each level can split (its fee plus 1,000 sats per wallet, and enough for the level below):{' '}
                  {jarTree(config)
                    .map((n) => `${n.config.name} ${bch(minPaymentFor(n.config.members), 2)} BCH`)
                    .join(' · ')}
                  .
                </li>
              )}
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
              Source of the contract: <a href={`${SITE.repoUrl}/blob/main/contracts/Allpaid.cash`}>contracts/Allpaid.cash</a>. This page
              splits within seconds while it is open. With every page closed, anyone can run the keeper (<code>npm run keeper -- &lt;jar link&gt;</code>), a small program that
              sends the split for waiting payments. Every copy builds the same transaction, so it does not matter who
              sends it.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
