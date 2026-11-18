import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useRoute, onLinkClick } from './router';
import { Banner, Footer, Nav } from './components/Chrome';
import { clearDemoFromUrl, DEMO_EVENT, DEMO_RESET, demoInUrl } from './demo/trigger';
const LandingV3 = lazy(() => import('./landing3/LandingV3').then((m) => ({ default: m.LandingV3 })));

const Create = lazy(() => import('./pages/Create').then((m) => ({ default: m.Create })));
const JarRoute = lazy(() => import('./pages/JarPage').then((m) => ({ default: m.JarRoute })));
const AutoDemo = lazy(() => import('./demo/AutoDemo').then((m) => ({ default: m.AutoDemo })));

const TITLES = {
  home: 'Allpaid: One QR. All paid.',
  new: 'Make a jar · Allpaid',
  jar: 'Jar · Allpaid',
  try: 'Play-money jar · Allpaid',
  missing: 'Not found · Allpaid',
} as const;

export function App() {
  const route = useRoute();
  useEffect(() => {
    document.title = TITLES[route.page];
  }, [route.page]);

  // The automatic demo runs over every page, so it lives here, outside the routes.
  const [demo, setDemo] = useState(demoInUrl);
  // Bumped when a demo run starts or ends: /new and /try remount, so the demo never
  // leaves its sample addresses in the form or its payments in the play-money jar.
  const [pageKey, setPageKey] = useState(0);
  useEffect(() => {
    const start = () => setDemo(true);
    const reset = () => setPageKey((k) => k + 1);
    window.addEventListener(DEMO_EVENT, start);
    window.addEventListener(DEMO_RESET, reset);
    return () => {
      window.removeEventListener(DEMO_EVENT, start);
      window.removeEventListener(DEMO_RESET, reset);
    };
  }, []);
  const endDemo = useCallback(() => {
    setDemo(false);
    setPageKey((k) => k + 1);
    clearDemoFromUrl();
  }, []);

  return (
    <>
      <Banner />
      <Nav current={route.page === 'home' || route.page === 'missing' ? undefined : route.page} variant={route.page === 'home' ? 'v3' : undefined} />
      <Suspense fallback={<main className="wrap page-loading">Loading…</main>}>
        {route.page === 'home' && <LandingV3 />}
        {route.page === 'new' && <Create key={`new-${pageKey}`} />}
        {route.page === 'jar' && <JarRoute key={route.code} code={route.code} />}
        {route.page === 'try' && <JarRoute key={`try-${pageKey}`} sandbox />}
        {route.page === 'missing' && (
          <main className="wrap page-narrow">
            <h1 className="page-title">Nothing at this address</h1>
            <p className="lead">The page you asked for does not exist.</p>
            <p className="page-actions">
              <a className="btn btn-primary" href="/" onClick={onLinkClick}>
                Back to the start
              </a>
            </p>
          </main>
        )}
      </Suspense>
      {route.page !== 'home' && <Footer />}
      {demo && (
        <Suspense fallback={null}>
          <AutoDemo onExit={endDemo} />
        </Suspense>
      )}
    </>
  );
}
