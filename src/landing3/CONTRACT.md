# V3 landing contract (read fully before writing code)

Owner (Dex) wants the Allpaid landing to be as good as **moto-card.com**: Lenis smooth scroll, GSAP ScrollTrigger + SplitText reveals, a hero product on a dark stone plinth, visual explanations with floating glass status chips, a 3D-feeling tunnel of photos around the product, floating numbers at depth, a stacked caps list, a rows table, FAQ, a dark closing. Also **hyper-realistic grand full-bleed photo walls** with super detailed objects. Light sections stay Hozon-clean (white, generous space). Recipe: `../desain/v3/MOTO-RESEP.md` (path from repo root: `../desain/v3/`).

## Already built (do not rewrite; import and use)
- `motion3.ts`: Lenis + GSAP + ScrollTrigger are wired (`gsap`, `ScrollTrigger`, `reducedMotion()`, `scrollToTarget()`).
- `kit.tsx`: `Scene` (section shell; `tone="dark"|"light"`), `Wall` (full-bleed photo from `/v3/<name>.webp` with `-sm` phone source), `Photo`, `Caps` (caps headline with SplitText line reveal), `Lede`, `Pill` (pill button; `cursor="coin"|"split"` sets the coin cursor), `Chip` (glass status chip with check / refused cross), `useMotion(ref, (reduced, el) => {...})` (gsap.context scoped, reverted on unmount; when `reduced` is true set final states, no animation).
- `v3.css`: tokens and shared classes (`.v3-inner`, `.v3-caps`, `.v3-lede`, `.v3-actions`, `.v3-chip`, `.v3-shade-top/bottom`).
- `Cursor.tsx`: coin cursor. Elements with `data-cursor="coin"` turn it into a coin (use on the tin); `data-cursor="split"` splits it into four (use on pay actions).

## Your files only
Each scene is `sections/<Name>.tsx` (keep the exported function name) plus its own CSS file `sections/<name>.css` imported at the top of the component. Prefix every class with `v3-<name>-`. Do NOT edit kit.tsx, motion3.ts, v3.css, Cursor.tsx, LandingV3.tsx, or other agents' scenes. If you truly need a shared change, write it in your final report instead.

## Assets in `public/v3/` (each also has `-sm.webp` for phones; all cool-graded)
Walls: `wall-hero` (vast dark stone hall, shaft of light on the tin on a granite plinth), `hero-plinth` (tin on black granite plinth, dark stone room), `wall-coins` (coins frozen mid-fall in dark), `wall-split` (white set: one coin stream splits into four tins), `wall-merapi` (Merapi dawn over Jogja roofs, cooled), `wall-jogja` (Jogja night city lights), `wall-street` (Jogja night street, band from behind, tin on wet ground, Tugu in distance; cool monochrome), `wall-cheat` (marble hand reaching to the tin, stopped by a vertical blade of light, black), `wall-room` (dark room, tin on wooden table by a window), `wall-haze` (empty dark green-teal haze).
Objects/cards: `tin` (tin on white, square), `coins` (coins floating on white), `tins-nested` (one big + four small tins on white), `coin-slices` (one coin cut into 4 wedges, white), `team-podcast`, `team-festival`, `team-angkringan`, `team-studio`, `team-band`, `team-kitchen` (dark moody squares for the tunnel; band and kitchen have odd hands: small only), `use-podcast`, `use-venue`, `use-festival` (objects on white), `cta-sage` (tin on sage), `tin-matcap` (brushed-steel sphere, matcap).
Coming soon from Blender (code must work without them, falling back to `hero-plinth`/`tin`): `/v3/hero-loop.mp4` + `/v3/hero-poster.jpg` (tin on plinth, slow push-in, a coin drops into the slot), `/v3/turn/turn_0000.webp … turn_0071.webp` (72-frame 360° turntable of the tin, transparent, 1200²), `/v3/split-loop.mp4` + `/v3/split-poster.jpg`. Check existence with a HEAD fetch or an `<img onerror>`/`<video onerror>` fallback.

## Real data (never invent numbers)
Sample band jar (play money, same as /try): Vocals 30%, Drums 25%, Sound 20%, Road crew 25% (a jar of its own: Manager 40%, Stage 25%, Driver 20%, Photos 15%). For a 0.001 BCH (100,000 sats) payment: fee 1,000 sats; Vocals 29,700 · Drums 24,750 · Sound 19,800 · Road crew 24,750 → crew fee 1,000 → Manager 9,500 · Stage 5,937 · Driver 4,750 · Photos 3,563 sats. 1 payment · 2 levels · 7 wallets · 2 transactions. Fee per split 1,000 sats ≈ $0.002 (BCH $209.07, 17 Nov 2026). Cheats refused at contract line 32 ("one output per member, no extra outputs") and line 39 ("output 0 has the wrong amount"). Not audited: small amounts. Links: play money `/try`, make a jar `/new`, source `https://github.com/Stylenexy/allpaid`, slides from `SITE.slidesUrl` in `src/site.ts`.
Live play-money engine (real covenant, in-tab BCH VM) if a scene wants it: `import { useJar } from '../../hooks/useJar'; import { SAMPLE_BAND } from '../../lib/sample';` → `const { engine, snap } = useJar(SAMPLE_BAND)`; `engine.simulatePayment(100_000n)`; `engine.armCheat('all' | 'swap')`; `snap.events` (kinds 'in' | 'split' | 'cheat'; split events have `amounts` per member and `node` "0" root / child ids; cheat events have `line`, `rule`, `code`), `snap.lastSplits`, `snap.splitCount`. Only ONE scene may create the engine: the Constellation scene. Others link to `/try` instead.

## Rules (Dex's, strict)
- English copy, ALL-CAPS headlines through `Caps` (Inter Tight 600), body via `Lede`. Headlines never squashed.
- No small text above titles (no eyebrows, no "01 /"), no bullet dots, no lines between sections, no white boxed panels on dark images. On dark, explanations are drawn as thin light lines + glass chips directly over the image's empty area.
- Text never over a photo's subject. One cool-neutral grade; BCH green `#0ac18e` only for money moving / primary action; refusal `#ff6b5e` only for refusals.
- Every motion means something (a payment, a split, a refusal, scale of use). Scroll-scrubbed motion uses ScrollTrigger `scrub` (with `pin` where Moto pins). Reduced motion: show the final state, no pin.
- Performance: no new npm deps (gsap, lenis, react only), no WebGL/three.js. CSS 3D transforms and canvas 2D are fine. Images lazy except the hero. Must be smooth at 1440×900 and usable at 360×780 (no horizontal scroll).
- Accessibility: images have real alt text (decorative ones `alt=""`), buttons are links/buttons with names, contrast ≥ 4.5:1 for body text.
- No AI branding anywhere.

## Verify before you report
1. `npx tsc -b` and `npm run build` pass. `npm test` still passes.
2. Visual check of YOUR scenes at 1440×900 and 360×780: run `npx vite --port <your port> --strictPort` in the background, then screenshot with Playwright **attached to the shared Chrome** (`chromium.connectOverCDP('http://127.0.0.1:9333')`, `browser.newContext({viewport})`). NEVER `chromium.launch()` or any new browser profile (it locks the owner's Windows account). For scroll-driven scenes take 3–4 screenshots at different scroll positions inside the scene (use `page.mouse.wheel` steps and waits). Look at them and fix what looks off. Save screenshots under `../desain/v3/render/scenes/<name>-*.png`. Stop your vite server when done.
3. Final report: files written, what moves and why, screenshots paths, anything you could not do, and any shared change you need.
