// Page chrome: the BLAZE banner, the top navigation and the footer.
import { useState } from 'react';
import { SITE } from '../site';
import { onLinkClick } from '../router';
import { Logo } from './TinMark';
import { shortAddress } from '../lib/format';

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
        {SITE.slidesUrl ? (
          <a href={SITE.slidesUrl} target="_blank" rel="noreferrer">
            Slides
          </a>
        ) : (
          <span className="banner-todo">Slides: link coming</span>
        )}
        <a href={SITE.repoUrl} target="_blank" rel="noreferrer">
          Source code
        </a>
        {SITE.emberAddress ? (
          <button type="button" className="banner-copy" onClick={copy} title={SITE.emberAddress}>
            EMBER2026 votes: <span className="mono">{shortAddress(SITE.emberAddress)}</span>
            <span aria-live="polite">{copied ? ' copied' : ''}</span>
          </button>
        ) : (
          <span className="banner-todo">EMBER2026 address: coming</span>
        )}
      </div>
    </div>
  );
}

export function Nav({ current }: { current?: 'home' | 'new' | 'try' | 'jar' }) {
  return (
    <header className="nav">
      <div className="nav-in wrap">
        <a href="/" onClick={onLinkClick} className="nav-home" aria-label="Splitjar home">
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

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-in">
        <div className="footer-cols">
          <p className="footer-line">
            Splitjar is open source (MIT). The contract has no owner key and has not been audited: use small amounts.
          </p>
          <nav className="footer-links" aria-label="Footer">
            <a href="/new" onClick={onLinkClick}>
              Make a jar
            </a>
            <a href="/try" onClick={onLinkClick}>
              Play-money jar
            </a>
            <a href={SITE.repoUrl} target="_blank" rel="noreferrer">
              Source and README
            </a>
            <a href={`${SITE.repoUrl}#credits--prior-work`} target="_blank" rel="noreferrer">
              Credits
            </a>
          </nav>
        </div>
        <p className="footer-word" aria-hidden="true">
          splitjar
        </p>
      </div>
    </footer>
  );
}
