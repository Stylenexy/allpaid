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
import { WatchButton } from '../demo/WatchButton';

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
  const [copied, setCopied] = useState(false);
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
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
              {sandbox && <WatchButton className="v3a-watch" />}
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
            <div className="v3a-side-block" data-rise data-demo="tree">
              <h2 className="side-title v3a-h3">Who gets what</h2>
              <SplitTree config={config} snap={snap} />
            </div>
            <div className="v3a-side-block" data-rise data-demo="activity">
              <h2 className="side-title v3a-h3">What happened</h2>
              <Activity config={config} snap={snap} />
            </div>
          </div>
        </div>

        <CheatPanel config={config} snap={snap} engine={engine} />

        <section className="rules v3a-rules" aria-labelledby="rules-title">
          <div className="v3a-rules-head" data-rise>
            <h2 id="rules-title" className="rules-title v3a-h2">
              What this jar's contract enforces
            </h2>
            <p className="hint">
              Source: <a href={`${SITE.repoUrl}/blob/main/contracts/Allpaid.cash`}>contracts/Allpaid.cash</a>. This page splits within seconds while it
              is open. With every page closed, anyone can run the keeper (<code>npm run keeper -- &lt;jar link&gt;</code>). Every copy builds the same
              transaction, so it does not matter who sends it.
            </p>
          </div>
          <dl className="v3a-terms">
            <div className="v3a-term" data-rise>
              <dt>
                <span className="v3a-term-fig num">{config.members.length}</span>
                <span className="v3a-term-unit">outputs per payment</span>
              </dt>
              <dd>One transaction, one output per member, in the shares above. The last member takes the rounding remainder, so no satoshi is lost.</dd>
            </div>
            <div className="v3a-term" data-rise>
              <dt>
                <span className="v3a-term-fig num">{sats(SPLIT_FEE)}</span>
                <span className="v3a-term-unit">sats fee per split</span>
              </dt>
              <dd>Fixed, and paid from the payment, so anyone can press split without a wallet. Nobody can take more.</dd>
            </div>
            <div className="v3a-term" data-rise>
              <dt>
                <span className="v3a-term-fig num">{sats(minPaymentFor(config.members))}</span>
                <span className="v3a-term-unit">sats smallest payment</span>
              </dt>
              <dd>
                {bch(minPaymentFor(config.members), 2)} BCH: every wallet gets at least 1,000 sats{nested ? ', and every nested jar enough to split again' : ''}.
                Smaller payments wait in the jar until two of them can be joined.
                {nested && (
                  <span className="v3a-term-note">
                    Per level:{' '}
                    {jarTree(config)
                      .map((n) => `${n.config.name} ${bch(minPaymentFor(n.config.members), 2)} BCH`)
                      .join(' · ')}
                  </span>
                )}
              </dd>
            </div>
            {nested && (
              <div className="v3a-term" data-rise>
                <dt>
                  <span className="v3a-term-fig num">{walletCount(config.members)}</span>
                  <span className="v3a-term-unit">wallets over {levelCount(config.members)} levels</span>
                </dt>
                <dd>
                  A member that is itself a jar is paid to its address like any other member. This page then splits that jar too, in its own transaction
                  with its own {sats(SPLIT_FEE)}-sat fee.
                </dd>
              </div>
            )}
            <div className="v3a-term" data-rise>
              <dt>
                <span className="v3a-term-fig num">0</span>
                <span className="v3a-term-unit">owner keys</span>
              </dt>
              <dd>The shares are part of the address itself. Change one share and you get a different jar.</dd>
            </div>
          </dl>
          <div className="v3a-addr" data-rise>
            <p className="v3a-addr-label">Jar address</p>
            <p className="v3a-addr-value mono">{address}</p>
            <div className="v3a-addr-actions">
              <button type="button" className="v3-pill v3a-pill--quiet v3a-pill--sm" onClick={copyAddress}>
                {copied ? 'Copied' : 'Copy'}
              </button>
              {addrLink && (
                <a className="v3-pill v3a-pill--quiet v3a-pill--sm" href={addrLink} target="_blank" rel="noreferrer">
                  Explorer <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
