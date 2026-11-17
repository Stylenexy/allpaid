// A tiny router: four pages do not need a library.
import { useEffect, useState } from 'react';

export type Route = { page: 'home' } | { page: 'new' } | { page: 'jar'; code: string } | { page: 'try' } | { page: 'missing' };

function read(): Route {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const code = location.hash.replace(/^#/, '');
  if (path === '/') return { page: 'home' };
  if (path === '/new') return { page: 'new' };
  if (path === '/try') return { page: 'try' };
  if (path === '/jar') return { page: 'jar', code };
  return { page: 'missing' };
}

export function navigate(href: string) {
  history.pushState(null, '', href);
  window.dispatchEvent(new Event('allpaid:navigate'));
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}

export function useRoute(): Route {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const update = () => setRoute(read());
    window.addEventListener('popstate', update);
    window.addEventListener('hashchange', update);
    window.addEventListener('allpaid:navigate', update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener('hashchange', update);
      window.removeEventListener('allpaid:navigate', update);
    };
  }, []);
  return route;
}

/** Intercept clicks on internal links so pages switch without a reload. */
export function onLinkClick(event: React.MouseEvent<HTMLAnchorElement>) {
  const a = event.currentTarget;
  if (event.metaKey || event.ctrlKey || event.shiftKey || a.target === '_blank') return;
  const url = new URL(a.href);
  if (url.origin !== location.origin) return;
  if (url.pathname === location.pathname && url.hash && !url.hash.startsWith('#/')) {
    // Same page anchor: let the browser scroll.
    if (url.pathname !== '/jar') return;
  }
  event.preventDefault();
  navigate(url.pathname + url.search + url.hash);
}
