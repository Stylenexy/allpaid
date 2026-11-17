// FAQ: Moto's layout on white. Big caps on the left (it stays while you
// read), categories with an accessible accordion on the right. Answers are
// honest about the limits: not audited, a lost wallet means a new jar.
import { useEffect, useId, useRef, useState } from 'react';
import { Caps, Scene, useMotion } from '../kit';
import { gsap, reducedMotion } from '../motion3';
import './faq.css';

type QA = { q: string; a: string };

const GROUPS: { cat: string; items: QA[] }[] = [
  {
    cat: 'About Allpaid',
    items: [
      {
        q: 'What is Allpaid?',
        a: 'One Bitcoin Cash address that pays a whole team. A covenant, a small contract written into the address, splits every payment into fixed shares and sends each member their part.',
      },
      {
        q: 'Do I need an account?',
        a: 'No. Anyone can pay the QR from any BCH wallet, and each member only needs a BCH address to receive. Connecting a wallet with WizardConnect is optional.',
      },
    ],
  },
  {
    cat: 'Safety',
    items: [
      {
        q: 'Can anyone change the shares?',
        a: 'No. The shares are written into the address itself, and no key can edit them, ours included. A different split is a different address.',
      },
      {
        q: 'What if every page is closed?',
        a: 'The payment waits safely in the jar. The split is sent the next time any jar page is open or a keeper round runs. Anyone can send it; nobody can change where it goes.',
      },
      {
        q: 'What if a member loses their wallet?',
        a: 'Their share keeps going to that address, because a jar cannot be edited. Make a new jar with their new address and share the new QR.',
      },
      {
        q: 'Is it audited?',
        a: 'No. Allpaid was built during BCH BLAZE 2026 and has not been audited. Please use small amounts.',
      },
    ],
  },
  {
    cat: 'Costs',
    items: [
      {
        q: 'What does a split cost?',
        a: '1,000 sats per split, about $0.002 with BCH at $209 (17 Nov 2026). Nested jars pay one fee per level, so the sample band, with its road crew jar, pays two.',
      },
    ],
  },
];

function Item({ q, a }: QA) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  // Smooth height: open to the answer's natural height, close back to zero.
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    if (!mounted.current) { mounted.current = true; return; }
    const still = reducedMotion();
    const body = el.firstElementChild;
    if (open) {
      gsap.set(el, { visibility: 'visible' });
      gsap.to(el, { height: 'auto', duration: still ? 0 : 0.6, ease: 'power3.inOut', overwrite: true });
      gsap.fromTo(body, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: still ? 0 : 0.5, delay: still ? 0 : 0.12, ease: 'power2.out', overwrite: true });
    } else {
      gsap.to(body, { autoAlpha: 0, duration: still ? 0 : 0.25, ease: 'power1.out', overwrite: true });
      gsap.to(el, { height: 0, duration: still ? 0 : 0.5, ease: 'power3.inOut', overwrite: true, onComplete: () => { gsap.set(el, { visibility: 'hidden' }); } });
    }
  }, [open]);

  return (
    <div className={`v3-faq-item${open ? ' is-open' : ''}`}>
      <h4 className="v3-faq-q">
        <button type="button" id={`${id}-q`} aria-expanded={open} aria-controls={`${id}-a`} onClick={() => setOpen((v) => !v)}>
          <span>{q}</span>
          <span className="v3-faq-icon" aria-hidden="true"><i /><i /></span>
        </button>
      </h4>
      <div ref={panel} id={`${id}-a`} className="v3-faq-panel">
        <div className="v3-faq-a">
          <p>{a}</p>
        </div>
      </div>
    </div>
  );
}

export function Faq() {
  const ref = useRef<HTMLDivElement>(null);

  useMotion(ref, (reduced, el) => {
    if (reduced) return;
    el.querySelectorAll('.v3-faq-group').forEach((group) => {
      gsap.from(group.querySelectorAll('.v3-faq-cat, .v3-faq-item'), {
        y: 28,
        autoAlpha: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.07,
        scrollTrigger: { trigger: group, start: 'top 86%', once: true },
      });
    });
  });

  return (
    <Scene id="faq" tone="light" className="v3-faq">
      <div ref={ref} className="v3-inner v3-faq-inner">
        <div className="v3-faq-head">
          <Caps align="left" className="v3-faq-title">
            Questions,<br />answered.
          </Caps>
        </div>
        <div className="v3-faq-body">
          {GROUPS.map((g) => (
            <div key={g.cat} className="v3-faq-group">
              <h3 className="v3-faq-cat">{g.cat}</h3>
              <div className="v3-faq-items">
                {g.items.map((it) => <Item key={it.q} {...it} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Scene>
  );
}
