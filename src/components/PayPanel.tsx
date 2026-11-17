// The pay card: a BIP21 QR any wallet can scan, plus WizardConnect for a
// wallet that pairs with the page and signs the payment it builds.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWizardConnect, WizardConnectQRDialog } from '@wizardconnect/react';
import type { JarConfig } from '../lib/jar';
import type { JarEngine, JarSnapshot } from '../lib/engine';
import { bch, bip21Amount, parseBch } from '../lib/format';
import { errorText, explorerTx, getProvider } from '../lib/chain';
import { payWithWallet, scanWallet, type WalletScan } from '../lib/wallet';
import { QR } from './QR';

const CHIPS = [50_000n, 100_000n, 500_000n, 1_000_000n];

export function PayPanel({ config, snap, engine }: { config: JarConfig; snap: JarSnapshot; engine: JarEngine }) {
  const options = CHIPS.filter((c) => c >= engine.min).slice(0, 3);
  const [amount, setAmount] = useState<bigint>(options[1] ?? options[0] ?? engine.min);
  const [custom, setCustom] = useState('');
  const customSats = custom ? parseBch(custom) : null;
  const chosen = customSats ?? amount;
  const tooSmall = chosen < engine.min;
  const uri = `${snap.address}?amount=${bip21Amount(chosen)}&message=${encodeURIComponent(`Allpaid: ${config.name}`)}`;
  const sandbox = config.net === 'sandbox';
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(snap.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <section className="pay" aria-labelledby="pay-title">
      <h2 id="pay-title" className="pay-title">
        {sandbox ? 'Pay play money into the jar' : `Pay ${config.name}`}
      </h2>

      <div className="chips" role="radiogroup" aria-label="Amount">
        {options.map((c) => (
          <button
            key={String(c)}
            type="button"
            role="radio"
            aria-checked={!customSats && amount === c}
            className={`chip num ${!customSats && amount === c ? 'is-on' : ''}`}
            onClick={() => {
              setAmount(c);
              setCustom('');
            }}
          >
            {bch(c)} BCH
          </button>
        ))}
        <label className="chip chip-input">
          <span className="visually-hidden">Other amount in BCH</span>
          <input
            aria-label="Other amount in BCH"
            inputMode="decimal"
            placeholder="other"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-invalid={custom !== '' && (customSats === null || tooSmall)}
          />
        </label>
      </div>

      {sandbox ? (
        <div className="pay-sandbox">
          <button
            type="button"
            className="btn btn-money"
            disabled={tooSmall || snap.status !== 'watching'}
            onClick={() => engine.simulatePayment(chosen)}
          >
            Pay {bch(chosen)} BCH into the jar
          </button>
          <p className="hint">
            Play money in a network that lives in this tab. The split is still built by the real contract and checked by the Bitcoin Cash VM.
          </p>
        </div>
      ) : (
        <>
          <div className="qr-card">
            <QR value={uri} label={`QR code: pay ${bch(chosen)} BCH to the ${config.name} jar`} size={236} />
            <p className="qr-amount num">{bch(chosen)} BCH</p>
            <p className="qr-address mono">{snap.address}</p>
          </div>
          <WizardPay config={config} jarAddress={snap.address} amount={chosen} disabled={tooSmall} />
          <div className="pay-row">
            <a className="btn btn-small" href={uri}>
              Open in a wallet app
            </a>
            <button type="button" className="btn btn-small" onClick={copyAddress}>
              {copied ? 'Address copied' : 'Copy address'}
            </button>
          </div>
          <p className="hint">Any Bitcoin Cash wallet can scan the QR. The split happens within seconds of the payment landing.</p>
        </>
      )}
      {tooSmall && <p className="problem pay-problem" role="alert">The smallest payment this jar can split is {bch(engine.min, 2)} BCH.</p>}
    </section>
  );
}

type PayState =
  | { step: 'idle' }
  | { step: 'scanning' }
  | { step: 'ready'; scan: WalletScan }
  | { step: 'signing'; scan: WalletScan }
  | { step: 'sent'; scan: WalletScan; txid: string }
  | { step: 'error'; message: string; scan?: WalletScan };

function WizardPay({ config, jarAddress, amount, disabled }: { config: JarConfig; jarAddress: string; amount: bigint; disabled: boolean }) {
  const icon = useMemo(() => `${location.origin}/icon-192.png`, []);
  const wc = useWizardConnect({ dappName: 'Allpaid', dappIcon: icon, sessionKey: 'allpaid-wizardconnect' });
  const [pay, setPay] = useState<PayState>({ step: 'idle' });
  const abort = useRef<AbortController | null>(null);

  // Once the wallet is connected, look up its coins.
  useEffect(() => {
    if (wc.state !== 'connected' || !wc.manager) return;
    let alive = true;
    setPay({ step: 'scanning' });
    (async () => {
      try {
        const provider = await getProvider(config.net);
        const scan = await scanWallet(wc.manager!, config.net, provider);
        if (alive) setPay({ step: 'ready', scan });
      } catch (error) {
        if (alive) setPay({ step: 'error', message: errorText(error) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [wc.state, wc.manager, config.net]);

  const send = async () => {
    if (!wc.manager || (pay.step !== 'ready' && pay.step !== 'sent' && pay.step !== 'error') || !('scan' in pay) || !pay.scan) return;
    const scan = pay.scan;
    setPay({ step: 'signing', scan });
    abort.current = new AbortController();
    try {
      const provider = await getProvider(config.net);
      const txid = await payWithWallet({
        manager: wc.manager,
        provider,
        scan,
        jarAddress,
        amount,
        prompt: `Pay ${bch(amount)} BCH into the "${config.name}" Allpaid jar`,
        signal: abort.current.signal,
      });
      const fresh = await scanWallet(wc.manager, config.net, provider).catch(() => scan);
      setPay({ step: 'sent', scan: fresh, txid });
    } catch (error) {
      setPay({ step: 'error', message: errorText(error), scan });
    }
  };

  const cancel = () => {
    abort.current?.abort('Cancelled on the page');
  };

  const link = pay.step === 'sent' ? explorerTx(config.net, pay.txid) : null;

  return (
    <div className="wiz">
      {wc.state !== 'connected' ? (
        <button type="button" className="btn btn-money wiz-main" onClick={() => wc.connect()} disabled={wc.state === 'connecting'}>
          {wc.state === 'connecting' ? 'Waiting for your wallet…' : wc.state === 'reconnecting' ? 'Reconnecting your wallet…' : 'Pay with WizardConnect'}
        </button>
      ) : (
        <>
          <p className="wiz-who">
            Connected to <strong>{wc.walletName ?? 'your wallet'}</strong>
            {'scan' in pay && pay.scan && <span className="num"> · {bch(pay.scan.balance)} BCH available</span>}
            <button type="button" className="btn btn-quiet btn-small" onClick={() => wc.disconnect()}>
              Disconnect
            </button>
          </p>
          {pay.step === 'signing' ? (
            <div className="wiz-row">
              <span className="wiz-wait" role="status">
                Approve the payment in your wallet…
              </span>
              <button type="button" className="btn btn-quiet btn-small" onClick={cancel}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-money wiz-main"
              onClick={send}
              disabled={disabled || pay.step === 'scanning' || !('scan' in pay) || !pay.scan || pay.scan.balance === 0n}
            >
              {pay.step === 'scanning' ? 'Reading your wallet…' : `Pay ${bch(amount)} BCH from this wallet`}
            </button>
          )}
        </>
      )}
      {pay.step === 'sent' && (
        <p className="wiz-ok" role="status">
          Payment sent.{' '}
          {link && (
            <a href={link} target="_blank" rel="noreferrer">
              View it
            </a>
          )}{' '}
          Watch the members below.
        </p>
      )}
      {pay.step === 'error' && (
        <p className="problem" role="alert">
          {pay.message}
        </p>
      )}
      {'scan' in pay && pay.scan && pay.scan.balance === 0n && pay.step === 'ready' && (
        <p className="hint">This wallet has no spendable BCH on {config.net === 'mainnet' ? 'mainnet' : 'chipnet'} in its first addresses.</p>
      )}
      {wc.error && <p className="problem">{wc.error}</p>}
      {wc.uri && wc.qrUri && (
        <WizardConnectQRDialog
          show={wc.state === 'connecting'}
          onClose={() => wc.disconnect()}
          uri={wc.uri}
          qrUri={wc.qrUri}
          title="Connect a wallet"
          subtitle="Scan this with a wallet that supports WizardConnect, or copy the link into a desktop wallet."
          theme={{
            backdropColor: 'rgba(0, 0, 0, 0.72)',
            dialogBackground: 'var(--surface-1)',
            headerBackground: 'var(--surface-1)',
            titleColor: 'var(--text)',
            subtitleColor: 'var(--text-soft)',
            qrForeground: 'var(--qr-ink)',
            qrBackground: 'var(--qr-bg)',
            uriRowBackground: 'var(--bg)',
            uriTextColor: 'var(--text-soft)',
            borderColor: 'var(--line-strong)',
            closeButtonColor: 'var(--text-soft)',
            copyButtonColor: 'var(--money)',
            qrSize: 260,
          }}
        />
      )}
    </div>
  );
}
