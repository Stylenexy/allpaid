// Starting the automatic demo from anywhere: a button calls startDemo(), a link adds ?demo.
// Kept tiny so the landing and the jar page do not load the demo itself until it runs.

export const DEMO_EVENT = 'allpaid:demo';

export function startDemo() {
  window.dispatchEvent(new Event(DEMO_EVENT));
}

/** A shared link such as allpaid.vercel.app/?demo starts the demo on arrival. */
export function demoInUrl(): boolean {
  return new URLSearchParams(location.search).has('demo');
}

/** Drop ?demo from the address bar once the demo is over, so a reload does not start it again. */
export function clearDemoFromUrl() {
  const params = new URLSearchParams(location.search);
  if (!params.has('demo')) return;
  params.delete('demo');
  const query = params.toString();
  history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
}
