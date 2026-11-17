// Story: where the idea comes from. A Jogja night street, a band playing with
// its back to us, the tin on the wet ground. The page dips from the white
// numbers through black into the street (night falls), then the photo drifts
// slower than the page so the street feels deep. Copy sits in the dark above
// the musicians, never on them or on the tin.
import { useRef } from 'react';
import { Caps, Lede, Scene, useMotion, Wall } from '../kit';
import { gsap } from '../motion3';
import './story.css';

/** Whether the scene before this one is light (looks through a pin-spacer). */
function prevIsLight(section: HTMLElement) {
  let prev = section.previousElementSibling as HTMLElement | null;
  if (prev?.classList.contains('pin-spacer')) prev = prev.firstElementChild as HTMLElement | null;
  return !!prev?.classList.contains('v3-scene--light');
}

export function Story() {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(ref, (reduced, el) => {
    if (el.parentElement) el.classList.toggle('is-after-light', prevIsLight(el.parentElement));
    if (reduced) return;
    // The street drifts slower than the page and settles: depth, not decoration.
    gsap.fromTo(
      '.v3-story-zoom',
      { yPercent: -5, scale: 1.1 },
      {
        yPercent: 5,
        scale: 1.02,
        ease: 'none',
        scrollTrigger: { trigger: '.v3-story-stage', start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  });

  return (
    <Scene id="story" tone="dark" className="v3-story">
      <div ref={ref} className="v3-story-root">
        <div className="v3-story-dip" aria-hidden="true" />
        <div className="v3-inner v3-story-copy">
          <Caps align="left">
            Shared tips.
            <br />
            No treasurer.
          </Caps>
          <div className="v3-story-text">
            <Lede className="v3-story-p">
              <strong>In Indonesia, a band passes a kencleng round the crowd.</strong> At the end of the night one person carries it home,
              counts it, and pays the others.
            </Lede>
            <Lede className="v3-story-p">
              <strong>Allpaid moves the counting into the money.</strong> The QR points at a covenant that lets coins out one way only: in fixed
              shares, to every member, at once.
            </Lede>
          </div>
        </div>
        <div className="v3-story-stage">
          <div className="v3-story-zoom">
            <Wall
              name="wall-street"
              alt="A Jogja street at night after rain: three musicians play with their backs to us, Tugu in the distance, a steel tip tin on the wet stones"
            />
          </div>
        </div>
      </div>
    </Scene>
  );
}
