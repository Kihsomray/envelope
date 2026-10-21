/**
 * Domain model for weight and balance.
 *
 * Units throughout the domain layer: weight in pounds (lb), arm in inches aft of
 * the aircraft's datum (in), moment in pound-inches (lb-in), fuel in US gallons.
 * Conversions for display live in `format.ts`, never here.
 */

/** A CG envelope vertex: [arm (in), weight (lb)]. */
export type EnvelopeVertex = readonly [arm: number, weight: number];

export type StationKind = 'seat' | 'baggage';

export interface Station {
  readonly id: string;
  readonly label: string;
  readonly kind: StationKind;
  readonly arm: number;
  /** Structural limit for this station alone, if the POH gives one. */
  readonly maxWeight?: number;
}

/** A limit shared by several stations, e.g. "baggage areas A + B, 120 lb". */
export interface StationGroupLimit {
  readonly label: string;
  readonly stationIds: readonly string[];
  readonly maxWeight: number;
}

export interface FuelOption {
  readonly id: string;
  readonly label: string;
  readonly usableGal: number;
  readonly arm: number;
  /** Common partial fill marks, e.g. Piper "tabs". */
  readonly presets?: readonly { readonly label: string; readonly gal: number }[];
}

export type CategoryId = 'normal' | 'utility';

export interface Category {
  readonly id: CategoryId;
  readonly label: string;
  /** Absent when the POH lists none; the takeoff limit then applies on the ramp. */
  readonly maxRamp?: number;
  readonly maxTakeoff: number;
  readonly maxLanding: number;
  /** Closed polygon (first vertex is not repeated), any winding. Must be convex. */
  readonly envelope: readonly EnvelopeVertex[];
  /** Stations that must be empty to operate in this category. */
  readonly emptyStations?: readonly string[];
}

/** Manoeuvring speed table, [weight (lb), Va (KIAS)], ascending by weight. */
export type VaTable = readonly (readonly [weight: number, kias: number])[];

export type Airframe = 'high-wing' | 'low-wing';

export interface AircraftModel {
  readonly id: string;
  readonly name: string;
  readonly manufacturer: string;
  readonly designation: string;
  readonly airframe: Airframe;
  readonly datum: string;
  readonly source: string;
  readonly notes: readonly string[];
  readonly stations: readonly Station[];
  readonly groupLimits: readonly StationGroupLimit[];
  readonly fuelOptions: readonly FuelOption[];
  /** First entry is the primary category the airplane is normally flown in. */
  readonly categories: readonly [Category, ...Category[]];
  readonly va: VaTable;
  readonly fuelLbPerGal: number;
  /** POH sample (or representative real) basic empty weight, for a starting profile. */
  readonly sampleEmpty: { readonly weight: number; readonly arm: number };
  readonly defaults: {
    readonly taxiGal: number;
    readonly tripGal: number;
    readonly stations: Readonly<Record<string, number>>;
  };
}

/** One specific airplane: a model plus its own weighing record. */
export interface AircraftProfile {
  readonly id: string;
  readonly tail: string;
  readonly modelId: string;
  readonly fuelOptionId: string;
  readonly emptyWeight: number;
  readonly emptyArm: number;
  /** True while the empty weight is still the POH sample rather than this airplane's. */
  readonly usesSampleEmpty: boolean;
}

export interface Loading {
  /** Weight per station id, lb. Missing ids count as zero. */
  readonly stations: Readonly<Record<string, number>>;
  /** Usable fuel at engine start, gal. */
  readonly rampFuelGal: number;
  readonly taxiFuelGal: number;
  readonly tripFuelGal: number;
}

export interface MassPoint {
  readonly weight: number;
  readonly moment: number;
  /** moment / weight; 0 when weight is 0. */
  readonly arm: number;
}

export type ConditionId = 'ramp' | 'takeoff' | 'landing' | 'zeroFuel';
