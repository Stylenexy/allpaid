/** Section 7: who it is for. */
const CASES = [
  {
    title: 'Street bands and their crew',
    text: "One QR on the guitar case. Singer 30%, guitar 25%, cajón 20%, and 25% to the road crew's own jar, which splits four ways again.",
  },
  { title: 'Warung staff', text: 'A tip QR by the till for the cook, the server and the dishwasher, split the same way every day.' },
  { title: 'Creators who co-host', text: 'Two hosts and an editor, one donation address on the stream, shares the audience can check.' },
  { title: 'Event organisers', text: "A festival jar that pays each act's own jar, so every band splits its part again without anyone forwarding money." },
];

export function UseCases() {
  return (
    <section className="sec cases">
      <div className="wrap">
        <h2 className="sec-title">Made for people who earn together</h2>
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
