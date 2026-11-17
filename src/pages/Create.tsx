import { useEffect, useMemo, useState } from 'react';
import { useWizardConnect, WizardConnectQRDialog } from '@wizardconnect/react';
import {
  decodeJar,
  encodeJar,
  jarCodeFromLink,
  levelCount,
  minPaymentFor,
  MAX_DEPTH,
  MAX_MEMBERS,
  MIN_MEMBERS,
  TOTAL_BPS,
  validateJar,
  walletCount,
  type JarConfig,
  type Net,
  type SubJar,
} from '../lib/jar';
import { errorText, getProvider, jarAddress } from '../lib/chain';
import { freshReceiveAddresses, receiveAddresses } from '../lib/wallet';
import { bch } from '../lib/format';
import { navigate, onLinkClick } from '../router';
import { TinMark } from '../components/TinMark';

interface Row {
  name: string;
  /** What the user typed: a wallet address, or the link of another jar. */
  address: string;
  pct: string;
  /** Set when the address field holds a jar link: this member is a nested jar. */
  jar?: SubJar;
  linkProblem?: string;
}

const evenRows = (rows: Row[]): Row[] => {
  const n = rows.length;
  const base = Math.floor(TOTAL_BPS / n);
  return rows.map((r, i) => ({ ...r, pct: String(((i === n - 1 ? TOTAL_BPS - base * (n - 1) : base) / 100).toString()) }));
};

const toBps = (pct: string) => {
  const v = Number(pct.replace(',', '.'));
  return Number.isFinite(v) ? Math.round(v * 100) : NaN;
};

/** Apply to the latest rows so wallet lookups never replace a member's own edits. */
export function fillWalletRows(rows: Row[], addresses: string[]): Row[] {
  const occupied = new Set(rows.filter((r) => !r.jar).map((r) => r.address.trim().toLowerCase()));
  const available = addresses.filter((address) => !occupied.has(address.toLowerCase()));
  return rows.map((row, i) => {
    if (row.jar || row.address.trim()) return row;
    const address = available.shift();
    return address ? { ...row, address, name: row.name.trim() ? row.name : `My wallet ${i + 1}` } : row;
  });
}

export function Create() {
  const [name, setName] = useState('');
  const [net, setNet] = useState<Exclude<Net, 'sandbox'>>('mainnet');
  const [rows, setRows] = useState<Row[]>(evenRows([
    { name: '', address: '', pct: '' },
    { name: '', address: '', pct: '' },
    { name: '', address: '', pct: '' },
  ]));
  const [touched, setTouched] = useState(false);
  const icon = useMemo(() => `${location.origin}/icon-192.png`, []);
  const wc = useWizardConnect({ dappName: 'Allpaid', dappIcon: icon, sessionKey: 'allpaid-wizardconnect' });
  const [walletFill, setWalletFill] = useState(false);
  const [walletProblem, setWalletProblem] = useState('');
  const [walletFilled, setWalletFilled] = useState(false);

  useEffect(() => {
    if (!walletFill) return;
    if (wc.error || wc.state === 'disconnected') {
      setWalletProblem('Could not pair with your wallet. Please try again.');
      setWalletFill(false);
      return;
    }
    if (wc.state !== 'connected' || !wc.manager) return;
    const manager = wc.manager;
    let alive = true;
    (async () => {
      try {
        receiveAddresses(manager, net, 1);
        const provider = await getProvider(net);
        const addresses = await freshReceiveAddresses(manager, net, provider, MAX_MEMBERS);
        if (!alive) return;
        // Recheck the current rows after scanning: edits made while waiting take priority.
        setRows((current) => fillWalletRows(current, addresses));
        setWalletFilled(true);
      } catch (error) {
        if (alive) setWalletProblem(`Could not fill addresses from your wallet. ${errorText(error)}`);
      } finally {
        if (alive) setWalletFill(false);
      }
    })();
    return () => { alive = false; };
  }, [walletFill, wc.state, wc.manager, wc.error, net]);

  const fillFromWallet = () => {
    setWalletProblem('');
    setWalletFilled(false);
    setWalletFill(true);
    if (wc.state === 'connected') return;
    try {
      if (wc.connect()) return;
    } catch { /* Show the same retry message if pairing cannot start. */ }
    setWalletFill(false);
    setWalletProblem('Could not pair with your wallet. Please try again.');
  };

  const config: JarConfig = useMemo(
    () => ({
      name,
      net,
      members: rows.map((r) =>
        r.jar ? { name: r.name, address: '', bps: toBps(r.pct), jar: r.jar } : { name: r.name, address: r.address.trim(), bps: toBps(r.pct) },
      ),
    }),
    [name, net, rows],
  );
  const problems = useMemo(() => validateJar(config), [config]);
  const valid = problems.length === 0;
  const address = useMemo(() => (valid ? jarAddress(config) : null), [valid, config]);
  const total = rows.reduce((s, r) => s + (toBps(r.pct) || 0), 0);
  const problemFor = (field: string) => (touched ? problems.find((p) => p.field === field)?.message : undefined);

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  // A pasted jar link turns the member into a nested jar.
  const setAddress = (i: number, text: string) => {
    const code = jarCodeFromLink(text);
    if (!code) return update(i, { address: text, jar: undefined, linkProblem: undefined });
    const child = decodeJar(code);
    if (!child) return update(i, { address: text, jar: undefined, linkProblem: 'This jar link does not open. Copy the whole link again.' });
    if (child.net !== net) return update(i, { address: text, jar: undefined, linkProblem: `That jar is on ${child.net}; this one is on ${net}.` });
    if (levelCount(child.members) >= MAX_DEPTH) {
      return update(i, { address: text, jar: undefined, linkProblem: `That jar already splits over ${MAX_DEPTH - 1} levels. ${MAX_DEPTH} levels at most.` });
    }
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, address: text, name: r.name || child.name, jar: { name: child.name, members: child.members }, linkProblem: undefined } : r)));
  };
  const add = () => rows.length < MAX_MEMBERS && setRows((rs) => evenRows([...rs, { name: '', address: '', pct: '' }]));
  const remove = (i: number) => rows.length > MIN_MEMBERS && setRows((rs) => evenRows(rs.filter((_, j) => j !== i)));

  // Testing with real money: two addresses of your own, so the split comes back to you.
  const useOwnTwo = () => {
    setName((n) => n || 'My test jar');
    setRows([
      { name: 'My wallet A', address: '', pct: '50' },
      { name: 'My wallet B', address: '', pct: '50' },
    ]);
    setTimeout(() => document.getElementById('m0-addr')?.focus(), 0);
  };

  const open = () => {
    setTouched(true);
    if (!valid) return;
    navigate(`/jar#${encodeJar(config)}`);
  };
  const prefix = net === 'mainnet' ? 'bitcoincash:' : 'bchtest:';

  return (
    <main className="wrap create">
      <header className="agreement-intro"><h1 className="page-title">Write the split.<br /><span className="chrome-type">Lock it in.</span></h1>
      <TinMark size={120} /></header>
      <p className="lead">
        Write down who is in the group and how the money splits. That is the whole setup: the jar's address is computed from it, right here,
        and no server keeps a copy. To nest a jar (say, your crew's), make that jar first, then paste its link as a member here.
      </p>

      <div className="allocation-strip" aria-label="Your current allocation">
        {rows.map((row, i) => <div key={i} style={{ flexGrow: Math.max(1, toBps(row.pct) || 0) }}><strong>{row.pct || '0'}%</strong><span>{row.name || `Member ${i + 1}`}</span></div>)}
      </div>

      <form
        className="create-form"
        onSubmit={(e) => {
          e.preventDefault();
          open();
        }}
        noValidate
      >
        <div className="create-top">
          <div className="field">
            <label htmlFor="jar-name">Group name</label>
            <input
              id="jar-name"
              className="input"
              value={name}
              maxLength={40}
              placeholder="Malioboro Night Band"
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!problemFor('name')}
            />
            {problemFor('name') && <p className="problem">{problemFor('name')}</p>}
          </div>
          <fieldset className="field net-toggle">
            <legend>Network</legend>
            <div className="seg" role="radiogroup" aria-label="Network">
              {(['mainnet', 'chipnet'] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={net === n}
                  className={`seg-btn ${net === n ? 'is-on' : ''}`}
                  onClick={() => setNet(n)}
                >
                  {n === 'mainnet' ? 'Mainnet (real BCH)' : 'Chipnet (test coins)'}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <ol className="rows">
          {rows.map((r, i) => (
            <li key={i} className="row">
              <span className="row-n num" aria-hidden="true">
                {i + 1}
              </span>
              <div className="field row-name">
                <label htmlFor={`m${i}-name`}>Name</label>
                <input
                  id={`m${i}-name`}
                  className="input"
                  value={r.name}
                  maxLength={24}
                  placeholder={['Ayu', 'Bima', 'Cahyo', 'Dewi'][i]}
                  onChange={(e) => update(i, { name: e.target.value })}
                  aria-invalid={!!problemFor(`m${i}.name`)}
                />
              </div>
              <div className="field row-addr">
                <label htmlFor={`m${i}-addr`}>Payout address, or another jar's link</label>
                <input
                  id={`m${i}-addr`}
                  className="input mono"
                  value={r.address}
                  placeholder={`${prefix}q…  or  https://…/jar#…`}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  onChange={(e) => setAddress(i, e.target.value)}
                  aria-invalid={!!problemFor(`m${i}.address`)}
                />
              </div>
              <div className="field row-pct">
                <label htmlFor={`m${i}-pct`}>Share %</label>
                <input
                  id={`m${i}-pct`}
                  className="input num"
                  inputMode="decimal"
                  value={r.pct}
                  onChange={(e) => update(i, { pct: e.target.value })}
                  aria-invalid={!!problemFor(`m${i}.bps`)}
                />
              </div>
              <button
                type="button"
                className="btn btn-quiet btn-small row-x"
                onClick={() => remove(i)}
                disabled={rows.length <= MIN_MEMBERS}
                aria-label={`Remove member ${i + 1}`}
              >
                Remove
              </button>
              {r.jar && (
                <p className="row-nested">
                  Nested jar: {r.jar.name}, {r.jar.members.length} members ({r.jar.members.map((m) => m.name).join(', ')}). It splits again when
                  this jar pays it.
                </p>
              )}
              {r.linkProblem && <p className="problem row-problem">{r.linkProblem}</p>}
              {(problemFor(`m${i}.name`) || problemFor(`m${i}.address`) || problemFor(`m${i}.bps`)) && (
                <p className="problem row-problem">{problemFor(`m${i}.name`) ?? problemFor(`m${i}.address`) ?? problemFor(`m${i}.bps`)}</p>
              )}
            </li>
          ))}
        </ol>

        <div className="rows-foot">
          <button type="button" className="btn btn-small" onClick={useOwnTwo}>
            Test with two of my own addresses
          </button>
          {(net === 'mainnet' || net === 'chipnet') && (
            <button type="button" className="btn btn-small" onClick={fillFromWallet} disabled={walletFill || wc.state === 'connecting' || wc.state === 'reconnecting'}>
              {walletFill ? (wc.state === 'connected' ? 'Finding fresh addresses...' : 'Waiting for your wallet...') : 'Fill from my wallet (WizardConnect)'}
            </button>
          )}
          <button type="button" className="btn btn-small" onClick={add} disabled={rows.length >= MAX_MEMBERS}>
            Add a member
          </button>
          <button type="button" className="btn btn-small" onClick={() => setRows((rs) => evenRows(rs))}>
            Split evenly
          </button>
          <p className={`rows-total num ${total === TOTAL_BPS ? 'is-ok' : 'is-off'}`}>
            Total {(total / 100).toFixed(2).replace(/\.00$/, '')}%
          </p>
        </div>
        {(net === 'mainnet' || net === 'chipnet') && (
          <>
            <p className="hint">Your wallet shares its public keys only. The split pays these addresses, so the money comes back to you.</p>
            {walletFilled && <p className="hint" role="status">Empty member rows filled from your wallet.</p>}
            {(walletProblem || wc.error) && <p className="problem" role="alert">{walletProblem || 'Could not pair with your wallet. Please try again.'}</p>}
            {wc.uri && wc.qrUri && (
              <WizardConnectQRDialog
                show={wc.state === 'connecting'}
                onClose={() => { setWalletFill(false); void wc.disconnect(); }}
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
          </>
        )}
        {problemFor('bps') && <p className="problem">{problemFor('bps')}</p>}
        {problemFor('members') && <p className="problem">{problemFor('members')}</p>}

        <div className="create-preview" aria-live="polite">
          {address ? (
            <>
              <p className="preview-label">Your jar's address</p>
              <p className="mono preview-addr">{address}</p>
              <p className="hint">
                Computed from the members' addresses and shares. Payments of at least {bch(minPaymentFor(config.members), 2)} BCH split on
                their own{levelCount(config.members) > 1 ? `, over ${levelCount(config.members)} levels to ${walletCount(config.members)} wallets` : ''}.
              </p>
            </>
          ) : (
            <p className="hint">The jar's address appears here as soon as every member has a valid {prefix} address and the shares add up to 100%.</p>
          )}
        </div>

        <div className="create-actions">
          <button type="submit" className="btn btn-primary">
            Open the jar
          </button>
          <a className="btn btn-quiet" href="/try" onClick={onLinkClick}>
            Or try a play-money jar first
          </a>
        </div>
        <p className="hint">
          Use addresses you control. Mainnet jars move real money, and the contract has not been audited, so start with small amounts.
        </p>
      </form>
    </main>
  );
}
