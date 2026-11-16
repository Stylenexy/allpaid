// The split tree: the jar on top, its members below, and a nested jar's own
// members below that. Each line lights up when the split that pays it is
// accepted, level by level, with the amount and a link to that transaction.
import type { JarConfig, Member } from '../lib/jar';
import { levelCount, subConfig, walletCount } from '../lib/jar';
import type { JarEvent, JarSnapshot } from '../lib/engine';
import { explorerTx } from '../lib/chain';
import { bch, percent, shortAddress } from '../lib/format';
import { TinMark } from './TinMark';

interface Props {
  config: JarConfig;
  snap: JarSnapshot;
  /** Optional short role under each name (landing sample). */
  roles?: Record<string, string>;
}

export function SplitTree({ config, snap, roles }: Props) {
  const root = snap.lastSplits['0'];
  const wallets = walletCount(config.members);
  const levels = levelCount(config.members);
  const splitsInLastPayment = root ? Object.values(snap.lastSplits).filter((e) => e.at >= root.at - 50).length : 0;
  return (
    <div className="tree">
      <div className={`tree-root ${root ? 'is-paid' : ''}`} key={`root-${root?.id ?? 'none'}`}>
        <TinMark size={34} />
        <div>
          <p className="tree-root-name">{config.name}</p>
          <p className="tree-root-meta num">
            {root ? `${bch(root.satoshis ?? 0n)} BCH in` : `${levels === 1 ? 'one level' : `${levels} levels`}, ${wallets} wallets`}
          </p>
        </div>
      </div>
      <Level config={config} nodeId="0" snap={snap} roles={roles} depth={0} />
      <p className="tree-sum num" aria-live="polite">
        {root
          ? `1 payment · ${levels} ${levels === 1 ? 'level' : 'levels'} · ${wallets} wallets · ${splitsInLastPayment} split ${splitsInLastPayment === 1 ? 'transaction' : 'transactions'}`
          : `Every payment here reaches ${wallets} wallets.`}
      </p>
    </div>
  );
}

function Level({ config, nodeId, snap, roles, depth }: { config: JarConfig; nodeId: string; snap: JarSnapshot; roles?: Record<string, string>; depth: number }) {
  const split = snap.lastSplits[nodeId];
  return (
    <ol className={`tree-level depth-${depth}`}>
      {config.members.map((m, i) => (
        <Leaf key={`${i}-${split?.id ?? 'none'}`} member={m} amount={split?.amounts?.[i]} split={split} index={i} depth={depth} net={config.net} roles={roles}>
          {m.jar && <Level config={subConfig(config, m)} nodeId={`${nodeId}.${i}`} snap={snap} roles={roles} depth={depth + 1} />}
        </Leaf>
      ))}
    </ol>
  );
}

function Leaf({
  member,
  amount,
  split,
  index,
  depth,
  net,
  roles,
  children,
}: {
  member: Member;
  amount?: bigint;
  split?: JarEvent;
  index: number;
  depth: number;
  net: JarConfig['net'];
  roles?: Record<string, string>;
  children?: React.ReactNode;
}) {
  const link = split?.txid ? explorerTx(net, split.txid) : null;
  const role = roles?.[member.name];
  return (
    <li className={`leaf ${member.jar ? 'is-jar' : ''} ${amount ? 'is-paid' : ''}`} style={{ animationDelay: `${depth * 520 + index * 110}ms` }}>
      <div className="leaf-row">
        <span className="leaf-coin" aria-hidden="true">
          {member.jar ? <TinMark size={22} /> : null}
        </span>
        <span className="leaf-name">
          {member.name}
          {role && <span className="leaf-role"> · {role}</span>}
          {!role && member.jar && <span className="leaf-role"> · jar, splits again</span>}
        </span>
        <span className="leaf-share num">{percent(member.bps)}</span>
        <span className="leaf-amt num">
          {amount ? (
            link ? (
              <a href={link} target="_blank" rel="noreferrer" title="See this split on the explorer">
                +{bch(amount)}
              </a>
            ) : (
              `+${bch(amount)}`
            )
          ) : (
            <span className="leaf-wait">waiting</span>
          )}
        </span>
      </div>
      {!member.jar && member.address && (
        <p className="leaf-addr mono" title={member.address}>
          {shortAddress(member.address)}
        </p>
      )}
      {children}
    </li>
  );
}
