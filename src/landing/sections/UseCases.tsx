/** Section 7: who it is for. */
const CASES = [
  {
    title: 'Podcasts with several hosts',
    text: 'One donation address in the show notes. Hosts and the editor get their cut the moment a listener pays, and listeners can check the shares.',
  },
  {
    title: 'Restaurant tip pools',
    text: 'A tip QR on the bill for the whole floor: kitchen, servers, dishwashers. The contract splits the pool, not the manager at closing time.',
  },
  {
    title: 'Team fundraisers',
    text: 'A campaign run by a team (a FundMe page, a hackathon crew) collects to one address that pays every member their part.',
  },
  {
    title: 'Events and street bands',
    text: "A festival jar pays each act's jar, and each band splits its part again down to the crew. Where Splitjar started.",
  },
];

export function UseCases() {
  return (
    <section className="sec cases">
      <div className="wrap">
        <h2 className="sec-title">For teams that already get paid in Bitcoin Cash</h2>
        <ul className="case-list">
          {CASES.map((c) => (
            <li key={c.title}>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
