// The landing page is a list of independent sections, so each one can be
// redesigned or swapped on its own. Reorder or replace entries here.
import { Hero } from './sections/Hero';
import { Story } from './sections/Story';
import { HowItWorks } from './sections/HowItWorks';
import { useEffect, useRef } from 'react';
import { CheatScene } from './sections/CheatScene';
import { WhyBch } from './sections/WhyBch';
import { UseCases } from './sections/UseCases';
import { Cta } from './sections/Cta';

const SECTIONS = [Hero, Story, HowItWorks, CheatScene, WhyBch, UseCases, Cta];

export function Landing() {
  const stage = useRef<HTMLElement>(null);
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let alive = true;
    import('./motion').then(({ mountMotion }) => {
      if (alive && stage.current) dispose = mountMotion(stage.current);
    });
    return () => { alive = false; dispose?.(); };
  }, []);
  return (
    <main className="landing" ref={stage}>
      {SECTIONS.map((Section, i) => (
        <Section key={i} />
      ))}
    </main>
  );
}
