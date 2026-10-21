import { describe, expect, it } from 'vitest';
import { AIRCRAFT, getModel } from './aircraft';
import { evaluate } from './calc';
import { maneuveringSpeed, rangePosition, stallSpeedChange } from './effects';
import { assertConvex, checkPoint, limitsAt, weightRange } from './envelope';
import { findFixes } from './fixes';
import type { AircraftProfile, Loading } from './types';

const c172s = getModel('c172s');
const archer = getModel('pa28-181');

const profile172s: AircraftProfile = {
  id: 'test',
  tail: 'N12345',
  modelId: 'c172s',
  fuelOptionId: 'standard',
  emptyWeight: 1642,
  emptyArm: 38.12,
  usesSampleEmpty: false,
};

const loading = (stations: Record<string, number>, ramp = 53, taxi = 1.4, trip = 9): Loading => ({
  stations,
  rampFuelGal: ramp,
  taxiFuelGal: taxi,
  tripFuelGal: trip,
});

describe('aircraft data', () => {
  for (const model of AIRCRAFT) {
    describe(model.name, () => {
      it('has convex envelopes that top out at max takeoff weight', () => {
        for (const c of model.categories) {
          expect(() => assertConvex(c.envelope)).not.toThrow();
          expect(weightRange(c.envelope).max).toBe(c.maxTakeoff);
          expect(c.maxLanding).toBeLessThanOrEqual(c.maxTakeoff);
          if (c.maxRamp !== undefined) expect(c.maxRamp).toBeGreaterThanOrEqual(c.maxTakeoff);
        }
      });

      it('references only stations that exist', () => {
        const ids = new Set(model.stations.map((s) => s.id));
        expect(ids.size).toBe(model.stations.length);
        for (const g of model.groupLimits) for (const id of g.stationIds) expect(ids).toContain(id);
        for (const c of model.categories) for (const id of c.emptyStations ?? []) expect(ids).toContain(id);
        for (const id of Object.keys(model.defaults.stations)) expect(ids).toContain(id);
      });

      it('has an ascending Va table', () => {
        for (let i = 1; i < model.va.length; i++) {
          expect(model.va[i]![0]).toBeGreaterThan(model.va[i - 1]![0]);
        }
      });
    });
  }
});

describe('limitsAt', () => {
  const normal = c172s.categories[0].envelope;

  it('reads the flat forward limit below the break point', () => {
    expect(limitsAt(normal, 1950)).toEqual({ forward: 35, aft: 47.3 });
  });

  it('interpolates the sloped forward limit', () => {
    const limits = limitsAt(normal, 2250);
    expect(limits?.forward).toBeCloseTo(38, 10);
    expect(limits?.aft).toBe(47.3);
  });

  it('returns the full top edge at max weight', () => {
    expect(limitsAt(normal, 2550)).toEqual({ forward: 41, aft: 47.3 });
  });

  it('extends the side limits below the bottom of the chart', () => {
    expect(limitsAt(normal, 1200)).toEqual({ forward: 35, aft: 47.3 });
  });

  it('has no limits above max weight', () => {
    expect(limitsAt(normal, 2551)).toBeNull();
  });
});

describe('checkPoint', () => {
  const normal = c172s.categories[0].envelope;

  it('accepts a point exactly on a limit', () => {
    expect(checkPoint(normal, 2550, 41).ok).toBe(true);
    expect(checkPoint(normal, 2000, 47.3).ok).toBe(true);
  });

  it('reports how far aft of the limit the CG is', () => {
    const v = checkPoint(normal, 2000, 47.8);
    expect(v.ok).toBe(false);
    if (!v.ok && v.reason === 'aft') expect(v.excess).toBeCloseTo(0.5, 10);
    else throw new Error('expected an aft verdict');
  });

  it('reports forward CG against the sloped limit', () => {
    const v = checkPoint(normal, 2250, 37.9);
    expect(!v.ok && v.reason).toBe('forward');
  });

  it('reports overweight', () => {
    const v = checkPoint(normal, 2600, 42);
    expect(!v.ok && v.reason).toBe('overweight');
  });
});

describe('evaluate', () => {
  const typical = loading({ pilot: 170, frontPax: 170, baggage1: 50 });

  it('computes weights and moments for every condition', () => {
    const { conditions } = evaluate(c172s, profile172s, typical);
    expect(conditions.zeroFuel.point.weight).toBeCloseTo(2032, 6);
    expect(conditions.zeroFuel.point.moment).toBeCloseTo(79923.04, 6);
    expect(conditions.ramp.point.weight).toBeCloseTo(2350, 6);
    expect(conditions.takeoff.point.weight).toBeCloseTo(2341.6, 6);
    expect(conditions.takeoff.point.moment).toBeCloseTo(94783.84, 6);
    expect(conditions.takeoff.point.arm).toBeCloseTo(40.47824, 4);
    expect(conditions.landing.point.weight).toBeCloseTo(2287.6, 6);
    expect(conditions.landing.point.arm).toBeCloseTo(40.30068, 4);
  });

  it('passes a typical loading', () => {
    const e = evaluate(c172s, profile172s, typical);
    expect(e.ok).toBe(true);
    expect(e.takeoffLimits?.forward).toBeCloseTo(38.916, 6);
    expect(e.takeoffWeightMargin).toBeCloseTo(208.4, 6);
  });

  it('rejects an overweight takeoff and names the excess', () => {
    const e = evaluate(c172s, profile172s, loading({ pilot: 200, frontPax: 200, rearLeft: 200, rearRight: 100 }));
    expect(e.ok).toBe(false);
    const keys = e.primary.issues.map((i) => i.key);
    expect(keys).toContain('normal:ramp:weight');
    expect(keys).toContain('normal:takeoff:weight');
  });

  it('rejects an aft CG at takeoff', () => {
    const e = evaluate(c172s, profile172s, loading({ pilot: 120, rearLeft: 220, rearRight: 220, baggage1: 70, baggage2: 50 }, 20));
    expect(e.primary.issues.map((i) => i.key)).toContain('normal:takeoff:aft');
    expect(e.ok).toBe(false);
  });

  it('enforces station and combined baggage limits', () => {
    const e = evaluate(c172s, profile172s, loading({ pilot: 170, baggage1: 100, baggage2: 60 }));
    const keys = e.commonIssues.map((i) => i.key);
    expect(keys).toContain('station:baggage2');
    expect(keys).toContain('group:Baggage A + B');
    expect(e.ok).toBe(false);
  });

  it('flags burning more fuel than is on board and clamps landing fuel at zero', () => {
    const e = evaluate(c172s, profile172s, loading({ pilot: 170 }, 10, 1, 12));
    expect(e.commonIssues.map((i) => i.key)).toContain('fuel:exhausted');
    expect(e.conditions.landing.fuelGal).toBe(0);
  });

  it('flags more fuel than the tanks hold', () => {
    const e = evaluate(c172s, profile172s, loading({ pilot: 170 }, 60));
    expect(e.commonIssues.map((i) => i.key)).toContain('fuel:capacity');
  });

  it('treats invalid inputs as zero', () => {
    const e = evaluate(c172s, profile172s, loading({ pilot: Number.NaN, frontPax: -50 }, Number.POSITIVE_INFINITY));
    expect(e.conditions.ramp.point.weight).toBeCloseTo(1642, 6);
  });

  it('checks utility category eligibility separately', () => {
    const solo = evaluate(c172s, profile172s, loading({ pilot: 170 }, 30));
    expect(solo.secondary[0]?.ok).toBe(true);
    const withBags = evaluate(c172s, profile172s, loading({ pilot: 170, baggage1: 10 }, 30));
    expect(withBags.secondary[0]?.issues.map((i) => i.key)).toContain('utility:station:baggage1');
  });

  it('uses the takeoff limit on the ramp when the POH lists no ramp weight', () => {
    const p: AircraftProfile = { ...profile172s, modelId: 'pa28-181', emptyWeight: 1590, emptyArm: 87.5 };
    const e = evaluate(archer, p, loading({ pilot: 200, frontPax: 200, rearLeft: 200, rearRight: 80 }, 48, 1, 9));
    // 1590 + 680 + 288 = 2558 on the ramp: over 2550 even though takeoff is 2552.
    expect(e.primary.issues.map((i) => i.key)).toContain('normal:ramp:weight');
  });

  it('selects the fuel arm of the chosen tank option', () => {
    const c152 = getModel('c152');
    const p: AircraftProfile = { ...profile172s, modelId: 'c152', fuelOptionId: 'long-range', emptyWeight: 1136, emptyArm: 29.93 };
    const e = evaluate(c152, p, loading({ pilot: 170 }, 37.5, 0, 0));
    expect(e.fuel.arm).toBe(39.5);
    expect(e.rows.find((r) => r.id === 'fuel')?.moment).toBeCloseTo(37.5 * 6 * 39.5, 6);
  });
});

describe('findFixes', () => {
  it('returns nothing when the loading is legal', () => {
    expect(findFixes(c172s, profile172s, loading({ pilot: 170 }))).toEqual([]);
  });

  it('suggests verified fixes for an aft CG', () => {
    const bad = loading({ pilot: 120, rearLeft: 220, rearRight: 220, baggage1: 70, baggage2: 50 }, 20);
    const fixes = findFixes(c172s, profile172s, bad);
    expect(fixes.length).toBeGreaterThan(0);
    for (const f of fixes) expect(evaluate(c172s, profile172s, f.loading).ok).toBe(true);
    expect(fixes.map((f) => f.description)).toMatchInlineSnapshot(`
      [
        "Move the rear left passenger to the front passenger seat",
        "Leave at least 30 lb out of baggage area B",
      ]
    `);
  });

  it('suggests offloading fuel when overweight', () => {
    const heavy = loading({ pilot: 200, frontPax: 200, rearLeft: 180, rearRight: 60 }, 53, 1.4, 9);
    const fixes = findFixes(c172s, profile172s, heavy);
    const fuel = fixes.find((f) => f.key === 'fuel:less');
    expect(fuel).toBeDefined();
    expect(evaluate(c172s, profile172s, fuel!.loading).ok).toBe(true);
  });
});

describe('effects', () => {
  it('interpolates Va between POH weights', () => {
    expect(maneuveringSpeed(c172s.va, 2550)).toBe(105);
    expect(maneuveringSpeed(c172s.va, 2050)).toBeCloseTo(94, 10);
    expect(maneuveringSpeed(c172s.va, 1700)).toBe(90);
  });

  it('places the CG within the range', () => {
    expect(rangePosition({ forward: 35, aft: 47.3 }, 35)).toBe(0);
    expect(rangePosition({ forward: 35, aft: 47.3 }, 47.3)).toBe(1);
  });

  it('scales stall speed with the square root of weight', () => {
    expect(stallSpeedChange(2550, 2550)).toBe(0);
    expect(stallSpeedChange(2550 * 0.81, 2550)).toBeCloseTo(-0.1, 10);
  });
});
