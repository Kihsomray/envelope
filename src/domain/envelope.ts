import type { EnvelopeVertex } from './types';

export interface CgLimits {
  readonly forward: number;
  readonly aft: number;
}

/** Tolerance for comparisons on derived floating point values (lb or in). */
export const EPSILON = 1e-9;

export function weightRange(envelope: readonly EnvelopeVertex[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const [, w] of envelope) {
    min = Math.min(min, w);
    max = Math.max(max, w);
  }
  return { min, max };
}

export function armRange(envelope: readonly EnvelopeVertex[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const [a] of envelope) {
    min = Math.min(min, a);
    max = Math.max(max, a);
  }
  return { min, max };
}

/**
 * Forward and aft CG limits at a given weight: the horizontal slice through the
 * (convex) envelope polygon.
 *
 * Below the bottom of the chart the side limits continue straight down, since
 * the chart's lowest weight is a drawing boundary rather than a limitation.
 * Above the top of the envelope there are no limits: the airplane is overweight.
 */
export function limitsAt(envelope: readonly EnvelopeVertex[], weight: number): CgLimits | null {
  const { min, max } = weightRange(envelope);
  if (weight > max + EPSILON) return null;
  const w = Math.min(Math.max(weight, min), max);

  let forward = Infinity;
  let aft = -Infinity;
  const n = envelope.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = envelope[i]!;
    const [x2, y2] = envelope[(i + 1) % n]!;
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    if (w < lo - EPSILON || w > hi + EPSILON) continue;

    if (Math.abs(y2 - y1) < EPSILON) {
      forward = Math.min(forward, x1, x2);
      aft = Math.max(aft, x1, x2);
    } else {
      const x = x1 + ((w - y1) / (y2 - y1)) * (x2 - x1);
      forward = Math.min(forward, x);
      aft = Math.max(aft, x);
    }
  }
  return Number.isFinite(forward) && Number.isFinite(aft) ? { forward, aft } : null;
}

export type EnvelopeVerdict =
  | { readonly ok: true; readonly limits: CgLimits }
  | { readonly ok: false; readonly reason: 'overweight'; readonly excess: number }
  | {
      readonly ok: false;
      readonly reason: 'forward' | 'aft';
      readonly limits: CgLimits;
      /** How far past the limit the CG is, inches, always positive. */
      readonly excess: number;
    };

/** Whether a (weight, arm) point lies within the envelope, and if not, why. */
export function checkPoint(
  envelope: readonly EnvelopeVertex[],
  weight: number,
  arm: number,
): EnvelopeVerdict {
  const limits = limitsAt(envelope, weight);
  if (!limits) {
    return { ok: false, reason: 'overweight', excess: weight - weightRange(envelope).max };
  }
  if (arm < limits.forward - EPSILON) {
    return { ok: false, reason: 'forward', limits, excess: limits.forward - arm };
  }
  if (arm > limits.aft + EPSILON) {
    return { ok: false, reason: 'aft', limits, excess: arm - limits.aft };
  }
  return { ok: true, limits };
}

/** Throws if an envelope is not a usable convex polygon. Used by data tests. */
export function assertConvex(envelope: readonly EnvelopeVertex[]): void {
  const n = envelope.length;
  if (n < 3) throw new Error('Envelope needs at least 3 vertices');
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = envelope[i]!;
    const [bx, by] = envelope[(i + 1) % n]!;
    const [cx, cy] = envelope[(i + 2) % n]!;
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(cross) < EPSILON) continue;
    const s = Math.sign(cross);
    if (sign !== 0 && s !== sign) throw new Error(`Envelope is not convex at vertex ${i + 1}`);
    sign = s;
  }
}
