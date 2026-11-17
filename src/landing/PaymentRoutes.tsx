import type { JarSnapshot } from '../lib/engine';
import { SAMPLE_BAND } from '../lib/sample';
import { bch, percent } from '../lib/format';
import { ROUTE_LAYOUTS, routePath } from './route-geometry';

/** The chooser's routing scene, populated from the working sample contract. */
export function PaymentRoutes({ snap }: { snap: JarSnapshot }) {
  return <div className="payment-routes">
    <PaymentMap snap={snap} layout="wide" />
    <PaymentMap snap={snap} layout="phone" />
  </div>;
}

function PaymentMap({ snap, layout }: { snap: JarSnapshot; layout: keyof typeof ROUTE_LAYOUTS }) {
  const root = snap.lastSplits['0'];
  const crew = snap.lastSplits['0.3'];
  const { width, height, rootX, xs, leaves, nodeWidth, childWidth } = ROUTE_LAYOUTS[layout];
  const phone = layout === 'phone';
  const childY = phone ? 266 : 300;
  const crewNameY = phone ? 347 : 388;
  return (
    <svg className={`payment-map payment-map-${layout} ${root ? 'has-payment' : ''}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Fixed shares: Vocals 30%, Drums 25%, Sound 20%, Road crew 25%. Road crew splits 40%, 25%, 20%, 15% to four wallets. Amounts appear only after a local simulation.">
      {xs.map((x) => <path key={x} className="map-route map-primary" pathLength="1" d={routePath(rootX, 65, x, 135)} />)}
      <g className="map-crew-branches">
      {leaves.map((x) => <path key={x} className="map-route map-nested" pathLength="1" d={routePath(xs[3], 199, x, childY)} />)}
      </g>
      <rect className="map-root" x={rootX - (phone ? 110 : 140)} y="10" width={phone ? 220 : 280} height="56" rx="7" />
      <text className="map-value map-input" x={rootX} y="44" textAnchor="middle">{root ? `${bch(root.satoshis ?? 0n)} demo BCH` : 'One play-money payment'}</text>
      {SAMPLE_BAND.members.map((member, index) => <g key={member.name}>
        <rect className={`map-node ${member.jar ? 'map-jar' : ''}`} x={xs[index] - nodeWidth / 2} y="135" width={nodeWidth} height="64" rx="7" />
        <text className="map-name" x={xs[index]} y="159" textAnchor="middle">{member.name}</text>
        <text className="map-value" x={xs[index]} y="186" textAnchor="middle">{root ? bch(root.amounts?.[index] ?? 0n) : percent(member.bps)}</text>
      </g>)}
      {SAMPLE_BAND.members[3].jar!.members.map((member, index) => <g className="map-crew-child" key={member.name}>
        <rect className="map-node map-child" x={leaves[index] - childWidth / 2} y={childY} width={childWidth} height="60" rx="6" />
        <text className="map-value" x={leaves[index]} y={childY + 37} textAnchor="middle">{crew ? bch(crew.amounts?.[index] ?? 0n) : percent(member.bps)}</text>
        <text className="map-name" x={leaves[index]} y={crewNameY} textAnchor="middle">{member.name}</text>
      </g>)}
      {!phone && <g className="map-crew-child"><text className="map-caption" x="50" y="330">The crew has its own jar.</text>
      <text className="map-caption" x="50" y="357">The same rule works again.</text></g>}
    </svg>
  );
}

export function UseCaseTree({ title, members }: { title: string; members: readonly string[] }) {
  const xs = members.map((_, i) => 45 + i * 270 / (members.length - 1));
  return <svg className="case-tree" viewBox="0 0 360 190" role="img" aria-label={`${title}: one address splits to ${members.join(', ')}`}>
    {xs.map((x) => <path className="map-route" key={x} d={routePath(180, 50, x, 122)} />)}
    <rect className="map-root" x="80" y="6" width="200" height="44" rx="6" />
    <text className="map-value map-input" x="180" y="34" textAnchor="middle">{title}</text>
    {members.map((name, i) => <g key={name}>
      <rect className="map-node" x={xs[i] - 40} y="122" width="80" height="42" rx="6" />
      <text className="map-name" x={xs[i]} y="148" textAnchor="middle">{name}</text>
    </g>)}
  </svg>;
}
