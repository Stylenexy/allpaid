export const clamp = (value: number) => Math.max(0, Math.min(1, value));
const phase = (p: number, start: number, end: number) => clamp((p - start) / (end - start));

/** The three narrative beats share one reversible scroll position. */
export function sequenceAt(p: number, reduced = false) {
  const value = reduced ? 1 : clamp(p);
  return {
    lid: phase(value, 0, .3),
    routes: phase(value, .3, .7),
    morph: phase(value, .43, .7),
    nested: phase(value, .7, 1),
    intro: 1 - phase(value, .4, .64),
    finale: phase(value, .52, .7),
  };
}

export type StageStop = { at: number; color: readonly [number, number, number] };
export const STAGE_BLUE = [23, 45, 61] as const;
export const STAGE_SPLIT = [12, 48, 38] as const;
export const STAGE_REFUSED = [55, 26, 28] as const;

/** Stop positions are in pixels; every colour journey lasts at least a viewport. */
export function stageStops(split: number, cheat: number, cta: number, viewport: number): StageStop[] {
  const green = Math.max(viewport, split);
  const red = Math.max(green + viewport, cheat);
  return [
    { at: 0, color: STAGE_BLUE },
    { at: green, color: STAGE_SPLIT },
    { at: red, color: STAGE_REFUSED },
    { at: Math.max(red + viewport, cta), color: STAGE_BLUE },
  ];
}

export function stageAt(scroll: number, stops: readonly StageStop[]) {
  const end = stops.findIndex((stop) => scroll < stop.at);
  if (end < 0) return [...stops[stops.length - 1].color];
  if (end === 0) return [...stops[0].color];
  const a = stops[end - 1];
  const b = stops[end];
  const t = phase(scroll, a.at, b.at);
  const smooth = t * t * (3 - 2 * t);
  return a.color.map((channel, i) => Math.round(channel + (b.color[i] - channel) * smooth));
}
