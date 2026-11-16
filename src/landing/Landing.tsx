import { lazy, Suspense } from 'react';
import { onLinkClick } from '../router';
import { BigTin } from '../components/TinStage';
import { splitPot, SPLIT_FEE } from '../lib/jar';
import { bch, percent, sats } from '../lib/format';
import { SITE } from '../site';

const HeroDemo = lazy(() => import('./LiveDemo'));
const CheatDemo = lazy(() => import('./LiveDemo').then((m) => ({ default: m.CheatDemo })));

// One night's tin, split with the same arithmetic as the contract (src/lib/jar.ts).
const NIGHT = { total: 1_250_000n, members: [['Ayu', 'vocals', 4000], ['Bima', 'guitar', 3500], ['Cahyo', 'cajón', 2500]] as const };
const NIGHT_SPLIT = splitPot(NIGHT.total, NIGHT.members.map((m) => m[2]));

export function Landing() {
  return (
    <main className="landing">
      <section className="hero">
        <div className="wrap hero-in">
          <div className="hero-copy">
            <h1 className="hero-title">
              One QR.
              <br />
              Everyone
              <br />
              gets paid.
            </h1>
            <p className="hero-lead">
              Kencleng is a shared tip jar on Bitcoin Cash. Every payment to the group's QR splits to each member's wallet within seconds, in
              shares written into the contract. Nobody holds the money, so nobody has to be trusted with it.
            </p>
            <div className="hero-ctas">
              <a className="btn btn-brass" href="/new" onClick={onLinkClick}>
                Make a jar for your group
              </a>
              <a className="btn" href="#cheat">
                Try to cheat it
              </a>
            </div>
            <p className="hero-small">
              Free and open source. No account, no app to install: payers use any Bitcoin Cash wallet, or connect one with WizardConnect.
            </p>
          </div>
          <Suspense
            fallback={
              <div className="hero-demo is-loading">
                <div className="stage">
                  <div className="stage-tin">
                    <BigTin />
                  </div>
                </div>
              </div>
            }
          >
            <HeroDemo />
          </Suspense>
        </div>
      </section>

      <section className="story">
        <div className="wrap story-in">
          <div className="story-copy">
            <h2 className="story-title">After the last song, one person always ends up holding the tin.</h2>
            <p>
              On Malioboro street in Yogyakarta, a band plays, and a <em>kencleng</em> (a tip tin with a slot in the lid) goes around. Coins
              and notes pile in. Then one person carries it home, counts it, and pays the others back later. Everyone has to trust that count.
            </p>
            <p>
              Kencleng moves the counting into the money. The QR points at a Bitcoin Cash contract that lets coins out one way only: split, in
              fixed shares, to every member at once. Anyone can press split. Nobody can change it.
            </p>
          </div>
          <figure className="night-receipt" aria-label="Example split of one night's tin">
            <p className="nr-head">Tonight's tin</p>
            <p className="nr-total num">
              {bch(NIGHT.total)} <span>BCH</span>
            </p>
            <ul className="nr-lines">
              {NIGHT.members.map(([name, role, bps], i) => (
                <li key={name}>
                  <span>
                    {name} <small>{role}</small>
                  </span>
                  <span className="num">
                    {percent(bps)} · {bch(NIGHT_SPLIT[i])}
                  </span>
                </li>
              ))}
              <li className="nr-fee">
                <span>Network fee</span>
                <span className="num">{bch(SPLIT_FEE)}</span>
              </li>
            </ul>
            <p className="nr-stamp" aria-hidden="true">
              split by contract
            </p>
            <figcaption className="nr-cap">Worked out with the same arithmetic the contract enforces.</figcaption>
          </figure>
        </div>
      </section>

      <section className="how" id="how">
        <div className="wrap">
          <h2 className="how-title">How a payment becomes everyone's</h2>
          <ol className="track" aria-label="The path of one payment">
            <li className="track-step">
              <span className="track-dot num">1</span>
              <p className="track-name">Someone scans the QR and pays</p>
              <p className="track-text">From any Bitcoin Cash wallet. The coin lands at the jar's address.</p>
            </li>
            <li className="track-step">
              <span className="track-dot num">2</span>
              <p className="track-name">The jar sees it</p>
              <p className="track-text">A page with the jar open spots the coin within a couple of seconds.</p>
            </li>
            <li className="track-step track-money">
              <span className="track-dot num">3</span>
              <p className="track-name">The split goes out</p>
              <p className="track-text">One transaction, one output per member, in the shares the contract holds.</p>
            </li>
          </ol>
          <div className="how-facts">
            <p className="how-big">
              The split has no signature and no choices in it. Two phones racing to send it send the same bytes, with the same transaction id.
            </p>
            <p>
              Its fee, <span className="num">{sats(SPLIT_FEE)}</span> sats, is paid from the payment, so whoever presses split needs no wallet
              and gains nothing from pressing it. A payment too small to give everyone 1,000 sats waits until a second small one can join it.
            </p>
            <p>
              The member list and shares are not stored anywhere. They are part of the jar's address: change one share and you get a different
              address. The jar link carries the list, so anyone holding it can check what the QR will do with their money.
            </p>
          </div>
        </div>
      </section>

      <section className="cheat-sec" id="cheat">
        <div className="wrap cheat-sec-in">
          <div className="cheat-copy">
            <h2 className="cheat-sec-title">Now try to cheat it.</h2>
            <p>
              Say {NIGHT.members[0][0]} wants the whole tip. She builds a transaction that spends the jar's coin and pays only herself. It has
              the right input and a fair-looking fee. It goes straight to the Bitcoin Cash VM, with no check on our side first.
            </p>
            <p>The refusal below is the VM's own message. Under it, the line of the contract that caught the thief.</p>
          </div>
          <Suspense fallback={<div className="cheat-demo is-loading">Loading the play-money network…</div>}>
            <CheatDemo />
          </Suspense>
        </div>
      </section>

      <section className="why">
        <div className="wrap why-in">
          <h2 className="why-title">Why this runs on Bitcoin Cash</h2>
          <dl className="why-list">
            <div>
              <dt>The contract checks its own spending.</dt>
              <dd>
                Bitcoin Cash scripts can read the transaction that spends them (native introspection, since 2022). That is how a jar insists on
                its own split without anyone signing.
              </dd>
            </div>
            <div>
              <dt>Small payments stay worth it.</dt>
              <dd>
                A split costs <span className="num">{sats(SPLIT_FEE)}</span> sats however many members there are, a fraction of a cent, so a
                single coffee-sized tip can still be shared four ways.
              </dd>
            </div>
            <div>
              <dt>Seconds, at the moment it matters.</dt>
              <dd>
                The payment is visible to the network as soon as it is sent, and the split follows right after. The band sees it while still
                packing up.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="who">
        <div className="wrap">
          <h2 className="who-title">Made for people who earn together</h2>
          <div className="who-grid">
            <article className="who-main">
              <h3>Street bands</h3>
              <p>
                One QR taped to the guitar case. Singer 40%, guitar 35%, cajón 25%, decided once before the first song. Each player's phone
                gets their part while the next song starts.
              </p>
            </article>
            <article className="who-side">
              <h3>Warung crews</h3>
              <p>A tip QR by the till for the cook, the server and the dishwasher, split the same way every day.</p>
            </article>
            <article className="who-side">
              <h3>Creators who co-host</h3>
              <p>Two hosts and an editor, one donation address on the stream, shares the audience can check.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="close">
        <div className="wrap close-in">
          <h2 className="close-title">Pass the tin. Nobody has to hold it.</h2>
          <div className="hero-ctas">
            <a className="btn btn-brass" href="/new" onClick={onLinkClick}>
              Make a jar for your group
            </a>
            <a className="btn" href={SITE.demoJarPath || '/try'} onClick={onLinkClick}>
              {SITE.demoJarPath ? 'Pay into our demo jar on mainnet' : 'Open the play-money jar'}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
