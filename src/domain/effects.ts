import type { CgLimits } from './envelope';
import type { VaTable } from './types';

/**
 * Manoeuvring speed at a weight, interpolated linearly between POH table rows
 * (the method the POHs themselves allow). Outside the table it holds the end
 * values rather than extrapolating past published data.
 */
export function maneuveringSpeed(table: VaTable, weight: number): number {
  const first = table[0];
  const last = table[table.length - 1];
  if (!first || !last) throw new Error('Va table is empty');
  if (weight <= first[0]) return first[1];
  if (weight >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [w1, v1] = table[i - 1]!;
    const [w2, v2] = table[i]!;
    if (weight <= w2) return v1 + ((weight - w1) / (w2 - w1)) * (v2 - v1);
  }
  return last[1];
}

/** Where the CG sits in the allowed range: 0 at the forward limit, 1 at the aft limit. */
export function rangePosition(limits: CgLimits, arm: number): number {
  const span = limits.aft - limits.forward;
  return span > 0 ? (arm - limits.forward) / span : 0.5;
}

export type BalanceZone = 'forward' | 'balanced' | 'aft';

export function balanceZone(position: number): BalanceZone {
  if (position < 0.25) return 'forward';
  if (position > 0.75) return 'aft';
  return 'balanced';
}

export interface HandlingEffect {
  readonly label: string;
  readonly detail: string;
  /** Direction relative to a mid-range CG. */
  readonly trend: 'more' | 'less' | 'same';
}

/**
 * How the CG position changes the way the airplane flies. These are the
 * textbook effects (FAA-H-8083-1, Aircraft Weight and Balance Handbook, ch. 1).
 */
export function handlingEffects(zone: BalanceZone): readonly HandlingEffect[] {
  switch (zone) {
    case 'forward':
      return [
        { label: 'Stability', trend: 'more', detail: 'Very stable in pitch. It resists changes and settles back on its own.' },
        { label: 'Stall speed', trend: 'more', detail: 'Highest. The tail pushes down harder, so the wing carries extra load. POH stall speeds are measured here.' },
        { label: 'Elevator authority', trend: 'less', detail: 'Heavier pitch forces. You may run out of up elevator in the flare.' },
        { label: 'Cruise', trend: 'less', detail: 'A little slower and thirstier from the extra tail download.' },
      ];
    case 'aft':
      return [
        { label: 'Stability', trend: 'less', detail: 'Less stable in pitch. Light, sensitive controls that are easy to over-control.' },
        { label: 'Stall speed', trend: 'less', detail: 'Lower, but the stall can be sharper.' },
        { label: 'Stall and spin recovery', trend: 'less', detail: 'Harder. Past the aft limit recovery may not be possible.' },
        { label: 'Cruise', trend: 'more', detail: 'Slightly faster and more efficient with less tail download.' },
      ];
    case 'balanced':
      return [
        { label: 'Stability', trend: 'same', detail: 'Normal pitch stability and control forces.' },
        { label: 'Stall speed', trend: 'same', detail: 'A touch below the POH figures, which assume the most forward CG.' },
        { label: 'Elevator authority', trend: 'same', detail: 'Plenty of up elevator for the flare.' },
        { label: 'Cruise', trend: 'same', detail: 'As published.' },
      ];
  }
}

/**
 * Stall speed scales with the square root of weight. Returns the change
 * relative to max weight as a fraction, e.g. -0.04 for 4 % slower.
 */
export function stallSpeedChange(weight: number, maxWeight: number): number {
  if (weight <= 0 || maxWeight <= 0) return 0;
  return Math.sqrt(weight / maxWeight) - 1;
}
