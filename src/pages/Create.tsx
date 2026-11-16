import { useMemo, useState } from 'react';
import { encodeJar, minPayment, MAX_MEMBERS, MIN_MEMBERS, TOTAL_BPS, validateJar, type JarConfig, type Net } from '../lib/jar';
import { jarAddress } from '../lib/chain';
import { bch } from '../lib/format';
import { navigate, onLinkClick } from '../router';

interface Row {
  name: string;
  address: string;
  pct: string;
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

export function Create() {
  const [name, setName] = useState('');
  const [net, setNet] = useState<Exclude<Net, 'sandbox'>>('mainnet');
  const [rows, setRows] = useState<Row[]>(evenRows([
    { name: '', address: '', pct: '' },
    { name: '', address: '', pct: '' },
    { name: '', address: '', pct: '' },
  ]));
  const [touched, setTouched] = useState(false);

  const config: JarConfig = useMemo(
    () => ({ name, net, members: rows.map((r) => ({ name: r.name, address: r.address.trim(), bps: toBps(r.pct) })) }),
    [name, net, rows],
  );
  const problems = useMemo(() => validateJar(config), [config]);
  const valid = problems.length === 0;
  const address = useMemo(() => (valid ? jarAddress(config) : null), [valid, config]);
  const total = rows.reduce((s, r) => s + (toBps(r.pct) || 0), 0);
  const problemFor = (field: string) => (touched ? problems.find((p) => p.field === field)?.message : undefined);

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const add = () => rows.length < MAX_MEMBERS && setRows((rs) => evenRows([...rs, { name: '', address: '', pct: '' }]));
  const remove = (i: number) => rows.length > MIN_MEMBERS && setRows((rs) => evenRows(rs.filter((_, j) => j !== i)));

  const open = () => {
    setTouched(true);
    if (!valid) return;
    navigate(`/jar#${encodeJar(config)}`);
  };
  const prefix = net === 'mainnet' ? 'bitcoincash:' : 'bchtest:';

  return (
    <main className="wrap create">
      <h1 className="page-title">Make a jar for your group</h1>
      <p className="lead">
        Write down who is in the group and how the money splits. That is the whole setup: the jar's address is computed from it, right here,
        and no server keeps a copy. Share the link you get at the end.
      </p>

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
            <div className="seg" role="radiogroup">
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
                <label htmlFor={`m${i}-addr`}>Payout address</label>
                <input
                  id={`m${i}-addr`}
                  className="input mono"
                  value={r.address}
                  placeholder={`${prefix}q…`}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  onChange={(e) => update(i, { address: e.target.value })}
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
              {(problemFor(`m${i}.name`) || problemFor(`m${i}.address`) || problemFor(`m${i}.bps`)) && (
                <p className="problem row-problem">{problemFor(`m${i}.name`) ?? problemFor(`m${i}.address`) ?? problemFor(`m${i}.bps`)}</p>
              )}
            </li>
          ))}
        </ol>

        <div className="rows-foot">
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
        {problemFor('bps') && <p className="problem">{problemFor('bps')}</p>}
        {problemFor('members') && <p className="problem">{problemFor('members')}</p>}

        <div className="create-preview" aria-live="polite">
          {address ? (
            <>
              <p className="preview-label">Your jar's address</p>
              <p className="mono preview-addr">{address}</p>
              <p className="hint">
                Computed from the names' addresses and shares. Payments of at least {bch(minPayment(config.members.map((m) => m.bps)), 2)} BCH
                split on their own.
              </p>
            </>
          ) : (
            <p className="hint">The jar's address appears here as soon as every member has a valid {prefix} address and the shares add up to 100%.</p>
          )}
        </div>

        <div className="create-actions">
          <button type="submit" className="btn btn-brass">
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
