/*
 * Allpaid embed: one line on any page puts a "Pay this team on BCH" button there.
 *
 *   <script src="https://YOUR-ALLPAID-SITE/embed.js" data-allpaid="JAR-LINK-OR-CODE"></script>
 *
 * Legacy data-jar is also accepted. Optional: data-label="Tip the show".
 * The button opens the jar page, where the
 * payer scans the QR or connects a wallet. No tracking, no network requests.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var jar = script.getAttribute('data-allpaid') || script.getAttribute('data-jar') || '';
  var hash = jar.indexOf('#') >= 0 ? jar.slice(jar.indexOf('#') + 1) : jar;
  if (!/^[A-Za-z0-9_-]+$/.test(hash)) {
    console.warn('Allpaid embed: data-allpaid (or data-jar) must be a jar link or code');
    return;
  }
  var origin = new URL(script.src, location.href).origin;
  var a = document.createElement('a');
  a.href = origin + '/jar#' + hash;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = script.getAttribute('data-label') || 'Pay this team on BCH';
  a.setAttribute(
    'style',
    [
      'display:inline-flex',
      'align-items:center',
      'gap:8px',
      'padding:10px 16px',
      'border-radius:10px',
      'background:#0ac18e',
      'color:#04261b',
      'font:600 15px/1.2 system-ui,-apple-system,Segoe UI,sans-serif',
      'text-decoration:none',
    ].join(';'),
  );
  script.parentNode.insertBefore(a, script.nextSibling);
})();
