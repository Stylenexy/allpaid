import { onLinkClick } from '../../router';
import { SITE } from '../../site';

/** Section 8: the closing call to action. */
export function Cta() {
  return (
    <section className="sec cta">
      <div className="wrap cta-in">
        <h2 className="sec-title">One address. The whole team gets paid.</h2>
        <div className="ctas">
          <a className="btn btn-primary" href="/new" onClick={onLinkClick}>
            Make a Splitjar for your team
          </a>
          <a className="btn" href={SITE.demoJarPath || '/try'} onClick={onLinkClick}>
            {SITE.demoJarPath ? 'Pay into our demo jar on mainnet' : 'Open the play-money jar'}
          </a>
        </div>
      </div>
    </section>
  );
}
