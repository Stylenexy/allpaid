import { describe, expect, it } from 'vitest';
import { sequenceAt, stageAt, stageStops, STAGE_BLUE, STAGE_SPLIT, STAGE_REFUSED } from '../src/landing/scene-progress';
import { cheatResult } from '../src/landing/cheat-result';
import { ROUTE_LAYOUTS } from '../src/landing/route-geometry';
import type { JarEvent } from '../src/lib/engine';

describe('the scroll world', () => {
  it('opens the lid before routing, then completes routing before the crew splits', () => {
    expect(sequenceAt(0)).toMatchObject({ lid: 0, routes: 0, nested: 0, intro: 1 });
    expect(sequenceAt(.3)).toMatchObject({ lid: 1, routes: 0, nested: 0 });
    expect(sequenceAt(.7)).toMatchObject({ lid: 1, routes: 1, nested: 0, intro: 0, finale: 1 });
    expect(sequenceAt(1)).toMatchObject({ lid: 1, routes: 1, nested: 1, finale: 1 });
  });

  it('resolves reduced motion straight to the final world at any scroll position', () => {
    for (const p of [-1, 0, .5, 2]) expect(sequenceAt(p, true)).toEqual(sequenceAt(1));
    expect(sequenceAt(-1)).toEqual(sequenceAt(0));
    expect(sequenceAt(2)).toEqual(sequenceAt(1));
  });

  it('gives every light transition at least a full screen even when sections are short', () => {
    for (const viewport of [640, 768, 900]) {
      const stops = stageStops(100, 200, 300, viewport);
      for (let i = 1; i < stops.length; i++) expect(stops[i].at - stops[i - 1].at).toBeGreaterThanOrEqual(viewport);
      expect(stageAt(-1, stops)).toEqual(STAGE_BLUE);
      expect(stageAt(stops[1].at, stops)).toEqual(STAGE_SPLIT);
      expect(stageAt(stops[2].at, stops)).toEqual(STAGE_REFUSED);
      expect(stageAt(stops[3].at + 100, stops)).toEqual(STAGE_BLUE);
    }
  });

  it('keeps every output inside both diagram viewBoxes, including the 360 px layout', () => {
    for (const layout of Object.values(ROUTE_LAYOUTS)) {
      for (const x of layout.xs) {
        expect(x - layout.nodeWidth / 2).toBeGreaterThanOrEqual(0);
        expect(x + layout.nodeWidth / 2).toBeLessThanOrEqual(layout.width);
      }
      for (const x of layout.leaves) {
        expect(x - layout.childWidth / 2).toBeGreaterThanOrEqual(0);
        expect(x + layout.childWidth / 2).toBeLessThanOrEqual(layout.width);
      }
    }
  });
});

const event = (kind: JarEvent['kind'], id: string, node = '0'): JarEvent => ({ kind, id, node, at: 1, depth: 0, jarName: 'Local test' });

describe('the refusal animation evidence', () => {
  it('never lights the honest routes for old splits or for a refusal alone', () => {
    const refusal = event('cheat', 'refused');
    const oldRoot = event('split', 'old-root');
    const oldCrew = event('split', 'old-crew', '0.3');
    expect(cheatResult([oldCrew, oldRoot])).toEqual({ refusal: undefined, honest: false });
    expect(cheatResult([refusal, oldCrew, oldRoot])).toEqual({ refusal, honest: false });
    expect(cheatResult([event('split', 'root'), refusal, oldCrew])).toEqual({ refusal, honest: false });
  });

  it('requires both post-refusal split events even when timestamps are identical', () => {
    const refusal = event('cheat', 'refused');
    const paid = [event('split', 'crew', '0.3'), event('split', 'root'), refusal];
    expect(cheatResult(paid)).toEqual({ refusal, honest: true });
    const next = event('cheat', 'next');
    expect(cheatResult([next, ...paid])).toEqual({ refusal: next, honest: false });
  });
});
