// Allpaid V3 landing. Moto-style scenes, one smooth-scroll engine, one cursor.
// Each scene is its own file in ./sections; reorder or swap entries here.
import { useEffect } from 'react';
import { startSmooth, ScrollTrigger } from './motion3';
import { Cursor } from './Cursor';
import { Preloader } from './sections/Preloader';
import { Hero } from './sections/Hero';
import { Constellation } from './sections/Constellation';
import { Tunnel } from './sections/Tunnel';
import { Numbers } from './sections/Numbers';
import { Story } from './sections/Story';
import { Cheat } from './sections/Cheat';
import { Stack } from './sections/Stack';
import { Rows } from './sections/Rows';
import { How } from './sections/How';
import { Faq } from './sections/Faq';
import { Closing } from './sections/Closing';
import '@fontsource/inter-tight/latin-500.css';
import '@fontsource/inter-tight/latin-600.css';
import './v3.css';

const SCENES = [Hero, Constellation, Tunnel, Numbers, Story, Cheat, Stack, Rows, How, Faq, Closing];

export function LandingV3() {
  useEffect(() => {
    const stop = startSmooth();
    // The nav reads the scene under it: glass once scrolled, ink over light scenes.
    const nav = document.querySelector<HTMLElement>('.nav--v3');
    const navTriggers = nav
      ? [
          ScrollTrigger.create({ start: 40, end: 'max', onToggle: (self) => nav.classList.toggle('is-scrolled', self.isActive) }),
          ...Array.from(document.querySelectorAll<HTMLElement>('.v3-scene--light')).map((el) =>
            ScrollTrigger.create({ trigger: el, start: 'top 72px', end: 'bottom 72px', onToggle: (self) => nav.classList.toggle('on-light', self.isActive) }),
          ),
        ]
      : [];
    const t = setTimeout(() => ScrollTrigger.refresh(), 600);
    return () => {
      clearTimeout(t);
      navTriggers.forEach((s) => s.kill());
      nav?.classList.remove('is-scrolled', 'on-light');
      stop();
      ScrollTrigger.getAll().forEach((s) => s.kill());
    };
  }, []);
  return (
    <main className="v3 landing-v3">
      <Preloader />
      <Cursor />
      {SCENES.map((Scene, i) => <Scene key={i} />)}
    </main>
  );
}
