import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { QR } from '../components/QR';
import { demoConfig } from './demo-config';
import { jarAddress, explorerTx } from '../lib/chain';
import { JarEngine } from '../lib/engine';
import { bch } from '../lib/format';
import { SITE } from '../site';
import { onLinkClick } from '../router';
import { DepositCursor } from './deposit-cursor';

export function HeroPayment() {
  const config = useMemo(() => demoConfig(SITE.demoJarPath), []);
  if (config) return <ObservedPayment config={config} />;
  return (
    <div className="hero-payment demo-unconfigured">
      <div className="hero-qr"><QR value={`${location.origin}/try`} label="Open the Allpaid play-money demo" size={112} /></div>
      <div><strong>Scan to try the jar.</strong><p>Play money only. The live demo jar is not configured yet.</p><a href="/try" onClick={onLinkClick}>Open the working demo ↗</a></div>
    </div>
  );
}

function ObservedPayment({ config }: { config: NonNullable<ReturnType<typeof demoConfig>> }) {
  const engine = useMemo(() => new JarEngine(config, jarAddress(config), { observeOnly: true }), [config]);
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const cursor = useRef(new DepositCursor());
  const [receipt, setReceipt] = useState<{ txid: string; satoshis: bigint } | null>(null);
  useEffect(() => { engine.start(); return () => engine.stop(); }, [engine]);
  useEffect(() => {
    const fresh = cursor.current.read(snap);
    if (!fresh?.txid || fresh.satoshis === undefined) return;
    setReceipt({ txid: fresh.txid, satoshis: fresh.satoshis });
    const hero = document.querySelector('.hero');
    hero?.classList.remove('payment-observed');
    void hero?.getBoundingClientRect();
    hero?.classList.add('payment-observed');
  }, [snap.pollCount]);
  return (
    <div className="hero-payment">
      <a className="hero-qr" href={SITE.demoJarPath} onClick={onLinkClick}><QR value={snap.address} label={`Pay the ${config.net} demo jar`} size={128} /></a>
      <div><strong>{config.net === 'mainnet' ? 'Real BCH. Real shares.' : 'Chipnet demo. Test coins only.'}</strong>
        <p role="status">{snap.status === 'offline' ? 'Observer offline. Open the jar for details.' : snap.status === 'connecting' ? 'Connecting to the payment observer…' : receipt ? `${bch(receipt.satoshis)} BCH observed at the jar. Unconfirmed.` : 'Waiting for a payment. The jar is breathing.'}</p>
        {receipt ? <a href={explorerTx(config.net, receipt.txid)!} target="_blank" rel="noreferrer">Inspect the payment ↗</a> : <a href={SITE.demoJarPath} onClick={onLinkClick}>Inspect shares before paying ↗</a>}
      </div>
    </div>
  );
}
