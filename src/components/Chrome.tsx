// Page chrome: the BLAZE banner, the top navigation and the footer.
import { useState } from 'react';
import { SITE } from '../site';
import { onLinkClick } from '../router';
import { Logo } from './TinMark';
import { shortAddress, shortHash } from '../lib/format';

/** Required by BCH BLAZE 2026: slides, source code, and an EMBER2026 donation address. */
export function Banner() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!SITE.emberAddress) return;
    try {
      await navigator.clipboard.writeText(SITE.emberAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the address is visible anyway */
    }
  };
  return (
    <div className="banner" role="region" aria-label="BCH BLAZE 2026 project links">
      <div className="banner-in">
        <span className="banner-tag">BCH BLAZE 2026</span>
        <span className="banner-links">
          {SITE.slidesUrl ? (
            <a href={SITE.slidesUrl} target="_blank" rel="noreferrer">
              Slides<span aria-hidden="true" className="banner-arrow">↗</span>
            </a>
          ) : null}
          <a href={SITE.repoUrl} target="_blank" rel="noreferrer">
            Source code<span aria-hidden="true" className="banner-arrow">↗</span>
          </a>
          {SITE.emberAddress ? (
            <button type="button" className="banner-copy" onClick={copy} title={`Copy ${SITE.emberAddress}`}>
              <span className="banner-copy-label">EMBER2026 votes</span>
              <span className="mono banner-address-long">{shortAddress(SITE.emberAddress)}</span>
              <span className="mono banner-address-short">{shortHash(SITE.emberAddress.split(':').pop() || SITE.emberAddress)}</span>
              <span className="banner-copied" aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}

export function Nav({ current, variant }: { current?: 'home' | 'new' | 'try' | 'jar'; variant?: 'v3' }) {
  return (
    <header className={variant === 'v3' ? 'nav nav--v3' : 'nav nav--v3 nav--solid'}>
      <div className="nav-in wrap">
        <a href="/" onClick={onLinkClick} className="nav-home" aria-label="Allpaid home">
          <Logo />
        </a>
        <nav className="nav-links" aria-label="Main">
          <a href="/#how" className={`nav-link hide-sm`}>
            How it splits
          </a>
          <a href="/try" onClick={onLinkClick} className={`nav-link ${current === 'try' ? 'is-on' : ''}`}>
            Try with play money
          </a>
          <a href="/new" onClick={onLinkClick} className={`btn btn-primary btn-small ${current === 'new' ? 'is-on' : ''}`}>
            Make a jar
          </a>
        </nav>
      </div>
    </header>
  );
}

/**
 * Inner pages end on one quiet line (Stripe Checkout's footer): who made it, the
 * one safety note, the source. The nav above already holds every way onward.
 */
export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-in">
        <p className="footer-line">
          <strong>Allpaid</strong> is open source (MIT). The contract has no owner key and has not been audited: use small amounts.
        </p>
        <nav className="footer-links" aria-label="Footer">
          <a href={SITE.repoUrl} target="_blank" rel="noreferrer">
            Source and README
          </a>
          <a href={`${SITE.repoUrl}#credits--prior-work`} target="_blank" rel="noreferrer">
            Credits
          </a>
        </nav>
      </div>
    </footer>
  );
}
