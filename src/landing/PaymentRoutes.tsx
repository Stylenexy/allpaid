import type { JarSnapshot } from '../lib/engine';
import { SAMPLE_BAND } from '../lib/sample';
import { bch, percent } from '../lib/format';

/** The chooser's routing scene, populated from the working sample contract. */
export function PaymentRoutes({ snap }: { snap: JarSnapshot }) {
  const root = snap.lastSplits['0'];
  const crew = snap.lastSplits['0.3'];
  const xs = [140, 390, 640, 950];
  const leaves = [570, 720, 870, 1020];
  return (
    <svg className={`payment-map ${root ? 'has-payment' : ''}`} viewBox="0 0 1100 410" role="img" aria-label="A play-money payment reaches seven wallets over two contract levels. The road crew's share splits again.">
      {xs.map((x) => <path key={x} className="map-route" d={`M550 65V95Q550 110 ${x} 110H${x}V135`} />)}
      {leaves.map((x) => <path key={x} className="map-route map-nested" d={`M950 198v48q0 17 ${x - 950} 17H${x}V300`} />)}
      <rect className="map-root" x="410" y="10" width="280" height="56" rx="7" />
      <text className="map-value map-input" x="550" y="46" textAnchor="middle">{root ? `${bch(root.satoshis ?? 0n)} demo BCH` : 'One play-money payment'}</text>
      {SAMPLE_BAND.members.map((member, index) => <g key={member.name}>
        <rect className={`map-node ${member.jar ? 'map-jar' : ''}`} x={xs[index] - 100} y="135" width="200" height="64" rx="7" />
        <text className="map-name" x={xs[index]} y="159" textAnchor="middle">{member.name}</text>
        <text className="map-value" x={xs[index]} y="186" textAnchor="middle">{root ? bch(root.amounts?.[index] ?? 0n) : percent(member.bps)}</text>
      </g>)}
      {SAMPLE_BAND.members[3].jar!.members.map((member, index) => <g key={member.name}>
        <rect className="map-node map-child" x={leaves[index] - 65} y="300" width="130" height="60" rx="6" />
        <text className="map-value" x={leaves[index]} y="337" textAnchor="middle">{crew ? bch(crew.amounts?.[index] ?? 0n) : percent(member.bps)}</text>
        <text className="map-name" x={leaves[index]} y="388" textAnchor="middle">{member.name}</text>
      </g>)}
      <text className="map-caption" x="50" y="330">The crew has its own jar.</text>
      <text className="map-caption" x="50" y="357">The same rule works again.</text>
    </svg>
  );
}
