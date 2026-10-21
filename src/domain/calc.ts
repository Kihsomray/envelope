import { checkPoint, EPSILON, limitsAt, type CgLimits, type EnvelopeVerdict } from './envelope';
import type {
  AircraftModel,
  AircraftProfile,
  Category,
  ConditionId,
  FuelOption,
  Loading,
  MassPoint,
} from './types';

export interface LoadsheetRow {
  readonly id: string;
  readonly label: string;
  readonly kind: 'empty' | 'seat' | 'baggage' | 'fuel';
  readonly weight: number;
  readonly arm: number;
  readonly moment: number;
}

export interface Condition {
  readonly id: ConditionId;
  readonly label: string;
  readonly point: MassPoint;
  readonly fuelGal: number;
}

export type IssueSeverity = 'limit' | 'advisory';

export interface Issue {
  /** Stable key, e.g. "normal:takeoff:aft" or "station:baggage2". */
  readonly key: string;
  readonly severity: IssueSeverity;
  readonly message: string;
  readonly condition?: ConditionId;
}

export interface CategoryResult {
  readonly category: Category;
  readonly ok: boolean;
  readonly issues: readonly Issue[];
  readonly takeoff: EnvelopeVerdict;
  readonly landing: EnvelopeVerdict;
}

export interface Evaluation {
  readonly model: AircraftModel;
  readonly fuel: FuelOption;
  readonly rows: readonly LoadsheetRow[];
  readonly conditions: Readonly<Record<ConditionId, Condition>>;
  /** Limits that apply whatever the category: structural station limits and fuel. */
  readonly commonIssues: readonly Issue[];
  readonly primary: CategoryResult;
  readonly secondary: readonly CategoryResult[];
  /** True when every limit is met in the primary category. Advisories don't count. */
  readonly ok: boolean;
  /** Primary category CG limits at takeoff weight, null if overweight. */
  readonly takeoffLimits: CgLimits | null;
  /** Weight that could still be added before the primary max takeoff weight. Negative when over. */
  readonly takeoffWeightMargin: number;
}

export function massPoint(weight: number, moment: number): MassPoint {
  return { weight, moment, arm: weight > EPSILON ? moment / weight : 0 };
}

/** Treat anything that isn't a finite, non-negative number as zero. */
export function sanitize(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0;
}

export function fuelOptionFor(model: AircraftModel, id: string): FuelOption {
  return model.fuelOptions.find((f) => f.id === id) ?? model.fuelOptions[0]!;
}

const lb = (n: number) => `${Math.round(n).toLocaleString('en-US')} lb`;
const inches = (n: number) => `${n.toFixed(2)} in`;
const gal = (n: number) => `${Number(n.toFixed(1))} gal`;

const CONDITION_LABEL: Record<ConditionId, string> = {
  ramp: 'Ramp',
  takeoff: 'Takeoff',
  landing: 'Landing',
  zeroFuel: 'Zero fuel',
};

export function evaluate(
  model: AircraftModel,
  profile: AircraftProfile,
  loading: Loading,
): Evaluation {
  const fuel = fuelOptionFor(model, profile.fuelOptionId);
  const density = model.fuelLbPerGal;

  const rampGal = sanitize(loading.rampFuelGal);
  const taxiGal = Math.min(sanitize(loading.taxiFuelGal), rampGal);
  const takeoffGal = rampGal - taxiGal;
  const landingGal = Math.max(takeoffGal - sanitize(loading.tripFuelGal), 0);

  const emptyWeight = sanitize(profile.emptyWeight);
  const rows: LoadsheetRow[] = [
    {
      id: 'empty',
      label: 'Basic empty weight',
      kind: 'empty',
      weight: emptyWeight,
      arm: profile.emptyArm,
      moment: emptyWeight * profile.emptyArm,
    },
  ];
  for (const s of model.stations) {
    const w = sanitize(loading.stations[s.id]);
    rows.push({ id: s.id, label: s.label, kind: s.kind, weight: w, arm: s.arm, moment: w * s.arm });
  }

  let zfWeight = 0;
  let zfMoment = 0;
  for (const r of rows) {
    zfWeight += r.weight;
    zfMoment += r.moment;
  }

  const withFuel = (g: number) => massPoint(zfWeight + g * density, zfMoment + g * density * fuel.arm);
  const condition = (id: ConditionId, g: number): Condition => ({
    id,
    label: CONDITION_LABEL[id],
    point: id === 'zeroFuel' ? massPoint(zfWeight, zfMoment) : withFuel(g),
    fuelGal: g,
  });
  const conditions: Record<ConditionId, Condition> = {
    ramp: condition('ramp', rampGal),
    takeoff: condition('takeoff', takeoffGal),
    landing: condition('landing', landingGal),
    zeroFuel: condition('zeroFuel', 0),
  };
  rows.push({
    id: 'fuel',
    label: `Fuel, ${gal(takeoffGal)} at takeoff`,
    kind: 'fuel',
    weight: takeoffGal * density,
    arm: fuel.arm,
    moment: takeoffGal * density * fuel.arm,
  });

  const commonIssues = stationAndFuelIssues(model, fuel, loading, rampGal);
  const [primaryCategory, ...others] = model.categories;
  const primary = checkCategory(model, primaryCategory, conditions, loading, true);
  const secondary = others.map((c) => checkCategory(model, c, conditions, loading, false));

  return {
    model,
    fuel,
    rows,
    conditions,
    commonIssues,
    primary,
    secondary,
    ok: primary.ok && commonIssues.every((i) => i.severity !== 'limit'),
    takeoffLimits: limitsAt(primaryCategory.envelope, conditions.takeoff.point.weight),
    takeoffWeightMargin: primaryCategory.maxTakeoff - conditions.takeoff.point.weight,
  };
}

function stationAndFuelIssues(
  model: AircraftModel,
  fuel: FuelOption,
  loading: Loading,
  rampGal: number,
): Issue[] {
  const issues: Issue[] = [];
  for (const s of model.stations) {
    const w = sanitize(loading.stations[s.id]);
    if (s.maxWeight !== undefined && w > s.maxWeight + EPSILON) {
      issues.push({
        key: `station:${s.id}`,
        severity: 'limit',
        message: `${s.label} holds ${lb(w)}, ${lb(w - s.maxWeight)} over its ${lb(s.maxWeight)} limit.`,
      });
    }
  }
  for (const g of model.groupLimits) {
    const w = g.stationIds.reduce((sum, id) => sum + sanitize(loading.stations[id]), 0);
    if (w > g.maxWeight + EPSILON) {
      issues.push({
        key: `group:${g.label}`,
        severity: 'limit',
        message: `${g.label} together hold ${lb(w)}, ${lb(w - g.maxWeight)} over the combined ${lb(g.maxWeight)} limit.`,
      });
    }
  }
  if (rampGal > fuel.usableGal + EPSILON) {
    issues.push({
      key: 'fuel:capacity',
      severity: 'limit',
      message: `${gal(rampGal)} of fuel is more than the ${gal(fuel.usableGal)} the tanks hold.`,
    });
  }
  const burn = sanitize(loading.taxiFuelGal) + sanitize(loading.tripFuelGal);
  if (burn > rampGal + EPSILON) {
    issues.push({
      key: 'fuel:exhausted',
      severity: 'limit',
      message: `Taxi and trip burn (${gal(burn)}) is more than the ${gal(rampGal)} on board.`,
      condition: 'landing',
    });
  }
  return issues;
}

function checkCategory(
  model: AircraftModel,
  category: Category,
  conditions: Readonly<Record<ConditionId, Condition>>,
  loading: Loading,
  isPrimary: boolean,
): CategoryResult {
  const issues: Issue[] = [];
  const key = (suffix: string) => `${category.id}:${suffix}`;
  const maxRamp = category.maxRamp ?? category.maxTakeoff;

  const ramp = conditions.ramp.point.weight;
  if (ramp > maxRamp + EPSILON) {
    issues.push({
      key: key('ramp:weight'),
      severity: 'limit',
      condition: 'ramp',
      message: `Ramp weight ${lb(ramp)} is ${lb(ramp - maxRamp)} over the ${lb(maxRamp)} maximum.`,
    });
  }

  const verdictFor = (id: 'takeoff' | 'landing', maxWeight: number): EnvelopeVerdict => {
    const { point, label } = conditions[id];
    if (point.weight > maxWeight + EPSILON) {
      issues.push({
        key: key(`${id}:weight`),
        severity: 'limit',
        condition: id,
        message: `${label} weight ${lb(point.weight)} is ${lb(point.weight - maxWeight)} over the ${lb(maxWeight)} maximum.`,
      });
    }
    const verdict = checkPoint(category.envelope, Math.min(point.weight, maxWeight), point.arm);
    if (!verdict.ok && verdict.reason !== 'overweight') {
      const limit = verdict.reason === 'aft' ? verdict.limits.aft : verdict.limits.forward;
      issues.push({
        key: key(`${id}:${verdict.reason}`),
        severity: 'limit',
        condition: id,
        message: `${label} CG ${inches(point.arm)} is ${inches(verdict.excess)} ${verdict.reason} of the ${inches(limit)} limit.`,
      });
    }
    return point.weight > maxWeight + EPSILON
      ? { ok: false, reason: 'overweight', excess: point.weight - maxWeight }
      : verdict;
  };

  const takeoff = verdictFor('takeoff', category.maxTakeoff);
  const landing = verdictFor('landing', category.maxLanding);

  for (const id of category.emptyStations ?? []) {
    if (sanitize(loading.stations[id]) > 0) {
      const station = model.stations.find((s) => s.id === id);
      issues.push({
        key: key(`station:${id}`),
        severity: 'limit',
        message: `${station?.label ?? id} must be empty in the ${category.label.toLowerCase()} category.`,
      });
    }
  }

  if (isPrimary && takeoff.ok && landing.ok) {
    const zf = conditions.zeroFuel.point;
    const zfVerdict = checkPoint(category.envelope, zf.weight, zf.arm);
    if (!zfVerdict.ok && zfVerdict.reason !== 'overweight') {
      issues.push({
        key: key(`zeroFuel:${zfVerdict.reason}`),
        severity: 'advisory',
        condition: 'zeroFuel',
        message: `With the tanks run dry the CG would be ${inches(zfVerdict.excess)} ${zfVerdict.reason} of limits. Land with fuel to spare.`,
      });
    }
  }

  return {
    category,
    ok: issues.every((i) => i.severity !== 'limit'),
    issues,
    takeoff,
    landing,
  };
}
