// The hands of the automatic demo. For each control it scrolls the page so the
// control sits above the caption card, moves a visible cursor there, rings it,
// then presses or types into the real control. Nothing on the page is faked: the
// jar, the split and the refusals that follow are the app's own.

import { navigate } from '../router';

/** Thrown when the demo is closed or restarted: the running steps stop quietly. */
export class Stopped extends Error {}

export type DemoUi = {
  layer: HTMLElement;
  cursor: HTMLElement;
  label: HTMLElement;
  ring: HTMLElement;
  ripple: HTMLElement;
  /** Top edge of the caption card: targets are kept above it. */
  freeBottom: () => number;
};

type Point = { x: number; y: number };
type Label = string | (() => string);

/** Milliseconds of demo time. The clock stops while the demo is paused. */
const TEMPO = {
  gap: 420,
  look: 2400,
  aimHold: 620,
  click: 240,
  perChar: 46,
  moveMin: 420,
  moveMax: 950,
  settle: 1500,
  find: 9000,
};

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Focusing an input on a phone opens its keyboard, so the demo only focuses with a mouse. */
const finePointer = () => matchMedia('(pointer: fine)').matches;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected || el.closest('[data-demo-ui]')) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const style = getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

/** Type into a React-controlled input the way the browser would. */
function setValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export class Driver {
  private pos: Point;
  private labelSize = { w: 0, h: 0 };
  private readonly reduced = reducedMotion();
  private readonly ui: DemoUi;
  private readonly signal: AbortSignal;
  private readonly paused: () => boolean;

  constructor(ui: DemoUi, signal: AbortSignal, paused: () => boolean) {
    this.ui = ui;
    this.signal = signal;
    this.paused = paused;
    this.pos = { x: innerWidth * 0.62, y: innerHeight * 0.42 };
    this.say(null);
    this.place(this.pos);
    ui.layer.dataset.on = '1';
  }

  private check() {
    if (this.signal.aborted) throw new Stopped();
  }

  /** Wait in demo time. */
  async wait(ms: number) {
    let left = ms;
    while (left > 0) {
      this.check();
      const step = Math.min(left, 60);
      await new Promise((resolve) => setTimeout(resolve, step));
      if (!this.paused()) left -= step;
    }
    this.check();
  }

  /** Wait until check() is true; false when it does not happen within max ms of demo time. */
  async until(check: () => boolean, max: number): Promise<boolean> {
    let spent = 0;
    while (!check()) {
      if (spent >= max) return false;
      await this.wait(100);
      spent += 100;
    }
    return true;
  }

  /** One requestAnimationFrame loop over ms of demo time; t runs 0..1. */
  private async frames(ms: number, onFrame: (t: number) => void) {
    if (ms <= 0 || this.reduced) {
      onFrame(1);
      this.check();
      return;
    }
    let spent = 0;
    let last = performance.now();
    while (spent < ms) {
      const now = await nextFrame();
      this.check();
      if (!this.paused()) spent += now - last;
      last = now;
      onFrame(Math.min(1, spent / ms));
    }
  }

  /** The first visible element for the selector, waiting for it to appear (a page still loading, a result still coming). */
  async find(selector: string, max = TEMPO.find): Promise<HTMLElement> {
    let found: HTMLElement | undefined;
    const ok = await this.until(() => {
      found = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(isVisible);
      return !!found;
    }, max);
    if (!ok || !found) throw new Error(`The demo could not find ${selector}`);
    return found;
  }

  // ── The cursor ────────────────────────────────────────────────

  say(label: string | null) {
    const el = this.ui.label;
    el.textContent = label ?? '';
    this.labelSize = { w: el.offsetWidth, h: el.offsetHeight };
    this.place(this.pos);
  }

  hide() {
    this.ui.layer.dataset.on = '0';
    this.ringOff();
  }

  /** The arrow's tip at p; the label beside it, flipped to stay on screen and above the card. */
  private place(p: Point) {
    this.pos = p;
    this.ui.cursor.style.transform = `translate3d(${Math.round(p.x - 3)}px, ${Math.round(p.y - 2)}px, 0)`;
    const { w, h } = this.labelSize;
    const right = p.x + 20 + w <= innerWidth - 10;
    const below = p.y + 28 + h <= this.ui.freeBottom() - 8;
    this.ui.label.style.transform = `translate(${right ? 20 : -(w + 8)}px, ${below ? 28 : -(h + 6)}px)`;
  }

  private aim(el: HTMLElement, fx: number, fy: number): Point {
    const r = el.getBoundingClientRect();
    return {
      x: clamp(r.left + r.width * fx, 10, innerWidth - 14),
      y: clamp(r.top + r.height * fy, 10, innerHeight - 14),
    };
  }

  /** Scroll so the element sits in the free band between the nav and the caption card. */
  private async reveal(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const nav = document.querySelector('header.nav')?.getBoundingClientRect();
    const top = Math.max(0, nav && nav.bottom > 0 ? nav.bottom : 0) + 20;
    const bottom = this.ui.freeBottom() - 20;
    const room = bottom - top;
    let delta: number;
    if (r.height >= room) {
      if (Math.abs(r.top - top) < 48) return;
      delta = r.top - top;
    } else {
      if (r.top >= top && r.bottom <= bottom) return;
      delta = r.top - top - (room - r.height) * 0.42;
    }
    const max = document.documentElement.scrollHeight - innerHeight;
    const y = clamp(scrollY + delta, 0, Math.max(0, max));
    if (Math.abs(y - scrollY) < 4) return;
    scrollTo({ top: y, behavior: this.reduced ? 'auto' : 'smooth' });
    let still = 0;
    let last = scrollY;
    let spent = 0;
    while (still < 4 && spent < TEMPO.settle) {
      await nextFrame();
      this.check();
      still = Math.abs(scrollY - last) < 0.5 ? still + 1 : 0;
      last = scrollY;
      spent += 16;
    }
  }

  /** Glide to the element along a shallow arc, following it if it still moves (a panel fading up). */
  private async move(el: HTMLElement, fx: number, fy: number) {
    const from = { ...this.pos };
    const first = this.aim(el, fx, fy);
    const dist = Math.hypot(first.x - from.x, first.y - from.y);
    const ms = clamp(TEMPO.moveMin + dist * 0.5, TEMPO.moveMin, TEMPO.moveMax);
    const lift = Math.min(36, dist * 0.08);
    await this.frames(ms, (t) => {
      const k = ease(t);
      const to = el.isConnected ? this.aim(el, fx, fy) : first;
      this.place({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k - Math.sin(Math.PI * k) * lift });
    });
  }

  private ringOn(el: HTMLElement, pulse: boolean) {
    const r = el.getBoundingClientRect();
    const pad = 6;
    const ring = this.ui.ring;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 10;
    ring.style.transform = `translate3d(${Math.round(r.left - pad)}px, ${Math.round(r.top - pad)}px, 0)`;
    ring.style.width = `${Math.round(r.width + pad * 2)}px`;
    ring.style.height = `${Math.round(r.height + pad * 2)}px`;
    ring.style.borderRadius = `${Math.min(radius + pad, (r.height + pad * 2) / 2)}px`;
    ring.dataset.on = '1';
    if (pulse && !this.reduced) {
      ring.dataset.pulse = '0';
      void ring.offsetWidth; // restart the pulse
      ring.dataset.pulse = '1';
    }
  }

  private ringOff() {
    this.ui.ring.dataset.on = '0';
    this.ui.ring.dataset.pulse = '0';
  }

  private ripple() {
    if (this.reduced) return;
    const r = this.ui.ripple;
    r.style.left = `${Math.round(this.pos.x)}px`;
    r.style.top = `${Math.round(this.pos.y)}px`;
    r.dataset.on = '0';
    void r.offsetWidth;
    r.dataset.on = '1';
  }

  /** Stay on the element for ms, ring and cursor following it. */
  private async hold(el: HTMLElement, ms: number, fx: number, fy: number) {
    await this.frames(this.reduced ? 0 : ms, () => {
      if (!el.isConnected) return;
      this.ringOn(el, false);
      this.place(this.aim(el, fx, fy));
    });
    if (this.reduced) await this.wait(ms);
  }

  private async approach(selector: string, label: Label, fx: number, fy: number): Promise<HTMLElement> {
    const el = await this.find(selector);
    this.say(typeof label === 'function' ? label() : label);
    await this.reveal(el);
    await this.move(el, fx, fy);
    this.ringOn(el, true);
    return el;
  }

  // ── What the steps use ────────────────────────────────────────

  /** Open a page of the app, the way a link would. */
  async go(path: string) {
    this.check();
    this.ringOff();
    this.say(null);
    if (location.pathname !== path) navigate(path);
    await this.wait(700);
  }

  /** Point at something and let it be read. */
  async look(selector: string, label: Label, ms = TEMPO.look, fx = 0.5, fy = 0.5) {
    const el = await this.approach(selector, label, fx, fy);
    await this.hold(el, ms, fx, fy);
    this.ringOff();
    await this.wait(TEMPO.gap);
  }

  /** Point at a button and press it, waiting first until it can be pressed. */
  async press(selector: string, label: Label) {
    const el = await this.find(selector);
    const ready = await this.until(() => !(el as HTMLButtonElement).disabled, 15_000);
    if (!ready) throw new Error(`${selector} stayed disabled`);
    await this.approach(selector, label, 0.5, 0.55);
    await this.hold(el, TEMPO.aimHold, 0.5, 0.55);
    this.ripple();
    await this.wait(TEMPO.click);
    el.click();
    this.ringOff();
    await this.wait(TEMPO.gap);
  }

  /** Click into a field and type, one character at a time. */
  async type(selector: string, text: string, label: Label, perChar = TEMPO.perChar) {
    const el = (await this.approach(selector, label, 0.28, 0.55)) as HTMLInputElement;
    this.ripple();
    await this.wait(160);
    if (finePointer()) el.focus({ preventScroll: true });
    setValue(el, '');
    for (let i = 1; i <= text.length; i += 1) {
      setValue(el, text.slice(0, i));
      await this.wait(perChar + ((i * 37) % 23));
    }
    await this.hold(el, 380, 0.28, 0.55);
    el.blur();
    this.ringOff();
    await this.wait(TEMPO.gap / 2);
  }

  /** Click into a field and paste a whole value at once. */
  async paste(selector: string, text: string, label: Label) {
    const el = (await this.approach(selector, label, 0.28, 0.55)) as HTMLInputElement;
    this.ripple();
    await this.wait(220);
    setValue(el, text);
    await this.hold(el, 420, 0.28, 0.55);
    this.ringOff();
    await this.wait(TEMPO.gap / 2);
  }
}
