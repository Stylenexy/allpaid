import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { JarEngine } from '../lib/engine';
import { jarAddress } from '../lib/chain';
import type { JarConfig } from '../lib/jar';

export function useJar(config: JarConfig) {
  const address = useMemo(() => jarAddress(config), [config]);
  const engine = useMemo(() => new JarEngine(config, address), [config, address]);
  useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, [engine]);
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  return { engine, snap, address };
}
