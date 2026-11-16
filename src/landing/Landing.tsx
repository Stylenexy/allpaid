// The landing page is a list of independent sections, so each one can be
// redesigned or swapped on its own. Reorder or replace entries here.
import { Hero } from './sections/Hero';
import { Story } from './sections/Story';
import { HowItWorks } from './sections/HowItWorks';
import { SplitTrees } from './sections/SplitTrees';
import { CheatScene } from './sections/CheatScene';
import { WhyBch } from './sections/WhyBch';
import { UseCases } from './sections/UseCases';
import { Cta } from './sections/Cta';

const SECTIONS = [Hero, Story, HowItWorks, SplitTrees, CheatScene, WhyBch, UseCases, Cta];

export function Landing() {
  return (
    <main className="landing">
      {SECTIONS.map((Section, i) => (
        <Section key={i} />
      ))}
    </main>
  );
}
