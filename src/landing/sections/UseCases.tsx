import { lazy, Suspense } from 'react';
const UseCaseTree = lazy(() => import('../PaymentRoutes').then((m) => ({ default: m.UseCaseTree })));

const CASES = [
  {
    title: 'Podcasts with several hosts',
    inlet: 'Listener support',
    members: ['Host A', 'Host B', 'Editor'],
    text: 'One donation address in the show notes. Hosts and the editor get their cut the moment a listener pays, and listeners can check the shares.',
  },
  {
    title: 'Restaurant tip pools',
    inlet: 'Staff tip pool',
    members: ['Kitchen', 'Servers', 'Dishes'],
    text: 'A tip QR on the bill for the whole floor: kitchen, servers, dishwashers. The contract splits the pool, not the manager at closing time.',
  },
  {
    title: 'Team-run FundMe campaigns',
    inlet: 'FundMe campaign',
    members: ['Outreach', 'Builders', 'Ops'],
    text: 'A campaign run by a team (a FundMe page, a hackathon crew) collects to one address that pays every member their part.',
  },
  {
    title: 'Street bands',
    inlet: 'After the encore',
    members: ['Vocals', 'Drums', 'Sound', 'Crew'],
    text: "A festival jar pays each act's jar, and each band splits its part again down to the crew. Where Allpaid started.",
  },
];

export function UseCases() {
  return (
    <section className="sec cases">
      <div className="wrap">
        <h2 className="sec-title">A shared address for shared work</h2>
        <ul className="case-list">
          {CASES.map((c) => (
            <li key={c.title}>
              <Suspense fallback={<div className="case-tree is-loading" />}><UseCaseTree title={c.inlet} members={c.members} /></Suspense>
              <div><h3>{c.title}</h3><p>{c.text}</p></div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
