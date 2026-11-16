/** Section 2: where the idea comes from. */
export function Story() {
  return (
    <section className="sec story">
      <div className="wrap narrow">
        <h2 className="sec-title">Every team has a treasurer. Every treasurer is a single point of failure.</h2>
        <p className="sec-text">
          The idea started on the street. In Indonesia, bands pass a <em>kencleng</em> around: a tip can with a slot in the lid. After the last
          song one person carries it home, counts it, and pays the others back later. Everyone has to trust that count. Tips have moved to QR
          codes since, but one QR still means one wallet, and one person who has to pay everyone else.
        </p>
        <p className="sec-text">
          Splitjar moves the counting into the money. The QR points at a Bitcoin Cash contract that lets coins out one way only: split, in
          fixed shares, to every member at once. Anyone can press split. Nobody can change the cut.
        </p>
      </div>
    </section>
  );
}
