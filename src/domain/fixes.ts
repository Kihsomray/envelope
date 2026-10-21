import { evaluate, sanitize } from './calc';
import type { AircraftModel, AircraftProfile, Loading, Station } from './types';

/**
 * Concrete, minimal changes that bring an out-of-limits loading back within
 * limits. Each candidate is verified with the same `evaluate` used everywhere
 * else, so a suggested fix is never one the app would then reject.
 */
export interface Fix {
  readonly key: string;
  readonly description: string;
  readonly loading: Loading;
}

interface Candidate {
  readonly key: string;
  /** Lower is easier for the pilot. */
  readonly cost: number;
  readonly describe: (amount: number) => string;
  /** Largest amount this action can apply. */
  readonly max: number;
  readonly step: number;
  readonly apply: (amount: number) => Loading;
}

const MAX_FIXES = 3;
const BALLAST_MAX_LB = 100;

const lb = (n: number) => `${Math.round(n)} lb`;
/** Sentence-case a label for use mid-sentence: "Baggage area B" becomes "baggage area B". */
const lower = (label: string) => label.charAt(0).toLowerCase() + label.slice(1);

export function findFixes(
  model: AircraftModel,
  profile: AircraftProfile,
  loading: Loading,
): Fix[] {
  if (evaluate(model, profile, loading).ok) return [];

  const fixes: (Fix & { cost: number })[] = [];
  for (const c of candidates(model, loading)) {
    const amount = smallestWorkingAmount(model, profile, c);
    if (amount === null) continue;
    fixes.push({
      key: c.key,
      description: c.describe(amount),
      loading: c.apply(amount),
      cost: c.cost * amount,
    });
  }
  // Cheapest first, at most one of each kind so the options are real alternatives.
  const kinds = new Set<string>();
  return fixes
    .sort((a, b) => a.cost - b.cost)
    .filter((f) => {
      const kind = f.key.split(':')[0]!;
      if (kinds.has(kind)) return false;
      kinds.add(kind);
      return true;
    })
    .slice(0, MAX_FIXES)
    .map(({ key, description, loading: l }) => ({ key, description, loading: l }));
}

/**
 * Smallest amount (in the candidate's steps) that makes the loading legal.
 * Monotonic in practice for every action generated below, but a linear scan
 * keeps that an observation rather than an assumption.
 */
function smallestWorkingAmount(
  model: AircraftModel,
  profile: AircraftProfile,
  c: Candidate,
): number | null {
  for (let amount = c.step; amount <= c.max + 1e-9; amount += c.step) {
    if (evaluate(model, profile, c.apply(amount)).ok) return amount;
  }
  return null;
}

function* candidates(model: AircraftModel, loading: Loading): Generator<Candidate> {
  const weight = (s: Station) => sanitize(loading.stations[s.id]);
  const withStations = (patch: Record<string, number>): Loading => ({
    ...loading,
    stations: { ...loading.stations, ...patch },
  });
  const baggage = model.stations.filter((s) => s.kind === 'baggage');
  const seats = model.stations.filter((s) => s.kind === 'seat');

  // Move baggage between compartments.
  for (const from of baggage) {
    for (const to of baggage) {
      if (from === to || weight(from) <= 0) continue;
      yield {
        key: `move:${from.id}:${to.id}`,
        cost: 1,
        max: weight(from),
        step: 1,
        describe: (n) => `Move at least ${lb(n)} from ${lower(from.label)} to ${lower(to.label)}`,
        apply: (n) => withStations({ [from.id]: weight(from) - n, [to.id]: weight(to) + n }),
      };
    }
  }

  // Reseat passengers. The pilot stays put, and mirror-image seats count once.
  const passengers = seats.filter((s) => s.id !== 'pilot');
  const seen = new Set<string>();
  for (let i = 0; i < passengers.length; i++) {
    for (let j = i + 1; j < passengers.length; j++) {
      const a = passengers[i]!;
      const b = passengers[j]!;
      if (a.arm === b.arm || weight(a) === weight(b)) continue;
      const signature = [`${a.arm}:${weight(a)}`, `${b.arm}:${weight(b)}`].sort().join('|');
      if (seen.has(signature)) continue;
      seen.add(signature);
      const [occupied, empty] = weight(a) === 0 ? [b, a] : weight(b) === 0 ? [a, b] : [null, null];
      yield {
        key: `swap:${a.id}:${b.id}`,
        cost: 15,
        max: 1,
        step: 1,
        describe: () =>
          occupied && empty
            ? `Move the ${lower(occupied.label)} passenger to the ${lower(empty.label)} seat`
            : `Swap the ${lower(a.label)} and ${lower(b.label)} passengers`,
        apply: () => withStations({ [a.id]: weight(b), [b.id]: weight(a) }),
      };
    }
  }

  // Leave baggage behind.
  for (const from of baggage) {
    if (weight(from) <= 0) continue;
    yield {
      key: `remove:${from.id}`,
      cost: 1.5,
      max: weight(from),
      step: 1,
      describe: (n) => `Leave at least ${lb(n)} out of ${lower(from.label)}`,
      apply: (n) => withStations({ [from.id]: weight(from) - n }),
    };
  }

  // Carry less fuel, never less than the planned taxi and trip burn.
  const rampGal = sanitize(loading.rampFuelGal);
  const neededGal = sanitize(loading.taxiFuelGal) + sanitize(loading.tripFuelGal);
  const spareGal = rampGal - neededGal;
  if (spareGal > 0) {
    yield {
      key: 'fuel:less',
      cost: 2 * model.fuelLbPerGal,
      max: spareGal,
      step: 0.5,
      describe: (g) => `Carry at least ${g} gal less fuel, if reserves allow`,
      apply: (g) => ({ ...loading, rampFuelGal: rampGal - g }),
    };
  }

  // Ballast, the last resort: secured weight in a baggage compartment.
  for (const to of baggage) {
    const room = Math.min(to.maxWeight ?? BALLAST_MAX_LB, BALLAST_MAX_LB) - weight(to);
    if (room <= 0) continue;
    yield {
      key: `ballast:${to.id}`,
      cost: 4,
      max: room,
      step: 1,
      describe: (n) => `Add at least ${lb(n)} of secured ballast in ${lower(to.label)}`,
      apply: (n) => withStations({ [to.id]: weight(to) + n }),
    };
  }
}
