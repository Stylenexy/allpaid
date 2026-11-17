import { lazy, Suspense, useEffect } from 'react';
import { useRoute, onLinkClick } from './router';
import { Banner, Footer, Nav } from './components/Chrome';
const LandingV3 = lazy(() => import('./landing3/LandingV3').then((m) => ({ default: m.LandingV3 })));

const Create = lazy(() => import('./pages/Create').then((m) => ({ default: m.Create })));
const JarRoute = lazy(() => import('./pages/JarPage').then((m) => ({ default: m.JarRoute })));

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

  return (
    <>
      <Banner />
      <Nav current={route.page === 'home' || route.page === 'missing' ? undefined : route.page} variant={route.page === 'home' ? 'v3' : undefined} />
      <Suspense fallback={<main className="wrap page-loading">Loading…</main>}>
        {route.page === 'home' && <LandingV3 />}
        {route.page === 'new' && <Create />}
        {route.page === 'jar' && <JarRoute key={route.code} code={route.code} />}
        {route.page === 'try' && <JarRoute sandbox />}
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
    </>
  );
}
