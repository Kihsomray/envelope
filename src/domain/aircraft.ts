import type { AircraftModel, Station } from './types';

/*
 * Aircraft data, transcribed from the Pilot's Operating Handbooks named in each
 * `source`. Envelopes are listed bottom-forward, clockwise. The lowest weight of
 * each envelope is the bottom of the POH chart, not a limitation.
 *
 * Basic empty weight in every POH below includes unusable fuel and full oil, so
 * neither appears as a loading station.
 */

const cessnaFour = (
  baggageNames: readonly [string, string],
): readonly Station[] => [
  { id: 'pilot', label: 'Pilot', kind: 'seat', arm: 37 },
  { id: 'frontPax', label: 'Front passenger', kind: 'seat', arm: 37 },
  { id: 'rearLeft', label: 'Rear left', kind: 'seat', arm: 73 },
  { id: 'rearRight', label: 'Rear right', kind: 'seat', arm: 73 },
  { id: 'baggage1', label: baggageNames[0], kind: 'baggage', arm: 95, maxWeight: 120 },
  { id: 'baggage2', label: baggageNames[1], kind: 'baggage', arm: 123, maxWeight: 50 },
];

const piperFour: readonly Station[] = [
  { id: 'pilot', label: 'Pilot', kind: 'seat', arm: 80.5 },
  { id: 'frontPax', label: 'Front passenger', kind: 'seat', arm: 80.5 },
  { id: 'rearLeft', label: 'Rear left', kind: 'seat', arm: 118.1 },
  { id: 'rearRight', label: 'Rear right', kind: 'seat', arm: 118.1 },
  { id: 'baggage', label: 'Baggage', kind: 'baggage', arm: 142.8, maxWeight: 200 },
];

const PIPER_NO_REAR = ['rearLeft', 'rearRight', 'baggage'] as const;
const CESSNA_NO_REAR = ['rearLeft', 'rearRight', 'baggage1', 'baggage2'] as const;

const piperFuel = [
  {
    id: 'standard',
    label: '48 gal usable',
    usableGal: 48,
    arm: 95,
    presets: [{ label: 'Tabs', gal: 34 }],
  },
] as const;

const piperNotes = [
  'Datum is 78.4 in ahead of the wing leading edge, at the inboard intersection of the straight and tapered sections.',
  'Utility category requires no rear passengers and no baggage.',
] as const;

const piperDefaults = {
  taxiGal: 1,
  tripGal: 10,
  stations: { pilot: 180 },
} as const;

export const AIRCRAFT: readonly AircraftModel[] = [
  {
    id: 'c172s',
    name: 'Cessna 172S Skyhawk SP',
    manufacturer: 'Cessna',
    designation: '172S',
    airframe: 'high-wing',
    datum: 'Lower portion of the front face of the firewall.',
    source: 'Cessna 172S Nav III POH, Section 6',
    notes: [
      'Baggage areas A and B together may not exceed 120 lb.',
      'Utility category requires the rear seat unoccupied and the baggage areas empty.',
    ],
    stations: cessnaFour(['Baggage area A', 'Baggage area B']),
    groupLimits: [
      { label: 'Baggage A + B', stationIds: ['baggage1', 'baggage2'], maxWeight: 120 },
    ],
    fuelOptions: [{ id: 'standard', label: '53 gal usable', usableGal: 53, arm: 48 }],
    categories: [
      {
        id: 'normal',
        label: 'Normal',
        maxRamp: 2558,
        maxTakeoff: 2550,
        maxLanding: 2550,
        envelope: [
          [35, 1500],
          [35, 1950],
          [41, 2550],
          [47.3, 2550],
          [47.3, 1500],
        ],
      },
      {
        id: 'utility',
        label: 'Utility',
        maxRamp: 2208,
        maxTakeoff: 2200,
        maxLanding: 2200,
        envelope: [
          [35, 1500],
          [35, 1950],
          [37.5, 2200],
          [40.5, 2200],
          [40.5, 1500],
        ],
        emptyStations: CESSNA_NO_REAR,
      },
    ],
    va: [
      [1900, 90],
      [2200, 98],
      [2550, 105],
    ],
    fuelLbPerGal: 6,
    sampleEmpty: { weight: 1642, arm: 38.12 },
    defaults: { taxiGal: 1.4, tripGal: 9, stations: { pilot: 180 } },
  },
  {
    id: 'c172n',
    name: 'Cessna 172N Skyhawk',
    manufacturer: 'Cessna',
    designation: '172N',
    airframe: 'high-wing',
    datum: 'Lower portion of the front face of the firewall.',
    source: '1980 Cessna 172N POH, Section 6',
    notes: [
      'Baggage areas 1 and 2 together may not exceed 120 lb.',
      'Utility category requires the rear seat unoccupied and the baggage areas empty.',
      'Data from the 1980 POH. Earlier 172N handbooks may differ; check yours.',
    ],
    stations: cessnaFour(['Baggage area 1', 'Baggage area 2']),
    groupLimits: [
      { label: 'Baggage 1 + 2', stationIds: ['baggage1', 'baggage2'], maxWeight: 120 },
    ],
    fuelOptions: [
      { id: 'standard', label: 'Standard tanks, 40 gal usable', usableGal: 40, arm: 48 },
      { id: 'long-range', label: 'Long-range tanks, 50 gal usable', usableGal: 50, arm: 48 },
    ],
    categories: [
      {
        id: 'normal',
        label: 'Normal',
        maxRamp: 2307,
        maxTakeoff: 2300,
        maxLanding: 2300,
        envelope: [
          [35, 1500],
          [35, 1950],
          [38.5, 2300],
          [47.3, 2300],
          [47.3, 1500],
        ],
      },
      {
        id: 'utility',
        label: 'Utility',
        maxRamp: 2007,
        maxTakeoff: 2000,
        maxLanding: 2000,
        envelope: [
          [35, 1500],
          [35, 1950],
          [35.5, 2000],
          [40.5, 2000],
          [40.5, 1500],
        ],
        emptyStations: CESSNA_NO_REAR,
      },
    ],
    va: [
      [1600, 80],
      [1950, 89],
      [2300, 97],
    ],
    fuelLbPerGal: 6,
    sampleEmpty: { weight: 1454, arm: 39.62 },
    defaults: { taxiGal: 1.1, tripGal: 8, stations: { pilot: 180 } },
  },
  {
    id: 'c152',
    name: 'Cessna 152',
    manufacturer: 'Cessna',
    designation: '152',
    airframe: 'high-wing',
    datum: 'Front face of the firewall.',
    source: '1980 Cessna 152 POH, Section 6',
    notes: [
      'The 152 is certificated in the utility category only.',
      'Baggage areas 1 and 2 together may not exceed 120 lb.',
      'Long-range tanks sit at a different arm (39.5 in) than standard tanks (42.0 in).',
    ],
    stations: [
      { id: 'pilot', label: 'Pilot', kind: 'seat', arm: 39 },
      { id: 'frontPax', label: 'Passenger', kind: 'seat', arm: 39 },
      { id: 'baggage1', label: 'Baggage area 1', kind: 'baggage', arm: 64, maxWeight: 120 },
      { id: 'baggage2', label: 'Baggage area 2', kind: 'baggage', arm: 84, maxWeight: 40 },
    ],
    groupLimits: [
      { label: 'Baggage 1 + 2', stationIds: ['baggage1', 'baggage2'], maxWeight: 120 },
    ],
    fuelOptions: [
      { id: 'standard', label: 'Standard tanks, 24.5 gal usable', usableGal: 24.5, arm: 42 },
      { id: 'long-range', label: 'Long-range tanks, 37.5 gal usable', usableGal: 37.5, arm: 39.5 },
    ],
    categories: [
      {
        id: 'utility',
        label: 'Utility',
        maxRamp: 1675,
        maxTakeoff: 1670,
        maxLanding: 1670,
        envelope: [
          [31, 1000],
          [31, 1350],
          [32.65, 1670],
          [36.5, 1670],
          [36.5, 1000],
        ],
      },
    ],
    va: [
      [1350, 93],
      [1500, 98],
      [1670, 104],
    ],
    fuelLbPerGal: 6,
    sampleEmpty: { weight: 1136, arm: 29.93 },
    defaults: { taxiGal: 0.8, tripGal: 6, stations: { pilot: 180 } },
  },
  {
    id: 'pa28-181',
    name: 'Piper PA-28-181 Archer',
    manufacturer: 'Piper',
    designation: 'PA-28-181',
    airframe: 'low-wing',
    datum: piperNotes[0],
    source: 'Piper PA-28-181 Archer III POH (VB-1563), Section 6',
    notes: [
      piperNotes[1],
      'Early Archer II handbooks (VB-760, 1976) use a 1950 lb utility envelope that is not modelled here.',
      'No ramp weight is used: the Archer II handbook lists none, so takeoff limits apply on the ramp.',
    ],
    stations: piperFour,
    groupLimits: [],
    fuelOptions: piperFuel,
    categories: [
      {
        id: 'normal',
        label: 'Normal',
        maxTakeoff: 2550,
        maxLanding: 2550,
        envelope: [
          [82, 1200],
          [82, 2050],
          [88.6, 2550],
          [93, 2550],
          [93, 1200],
        ],
      },
      {
        id: 'utility',
        label: 'Utility',
        maxTakeoff: 2130,
        maxLanding: 2130,
        envelope: [
          [82, 1200],
          [82, 2050],
          [83, 2130],
          [93, 2130],
          [93, 1200],
        ],
        emptyStations: PIPER_NO_REAR,
      },
    ],
    va: [
      [1634, 89],
      [2550, 113],
    ],
    fuelLbPerGal: 6,
    sampleEmpty: { weight: 1590, arm: 87.5 },
    defaults: piperDefaults,
  },
  {
    id: 'pa28-161-2440',
    name: 'Piper PA-28-161 Warrior II/III (2440 lb)',
    manufacturer: 'Piper',
    designation: 'PA-28-161',
    airframe: 'low-wing',
    datum: piperNotes[0],
    source: 'Piper PA-28-161 Warrior III POH (VB-1610) and Warrior II (VB-1180), Section 6',
    notes: [
      piperNotes[1],
      'For Warrior IIs from Aug 1982 and all Warrior IIIs. Earlier Warrior IIs are 2325 lb; pick that model instead.',
    ],
    stations: piperFour,
    groupLimits: [],
    fuelOptions: piperFuel,
    categories: [
      {
        id: 'normal',
        label: 'Normal',
        maxRamp: 2447,
        maxTakeoff: 2440,
        maxLanding: 2440,
        envelope: [
          [83, 1200],
          [83, 1950],
          [88.3, 2440],
          [93, 2440],
          [93, 1200],
        ],
      },
      {
        id: 'utility',
        label: 'Utility',
        maxRamp: 2027,
        maxTakeoff: 2020,
        maxLanding: 2020,
        envelope: [
          [83, 1200],
          [83, 1950],
          [83.8, 2020],
          [93, 2020],
          [93, 1200],
        ],
        emptyStations: PIPER_NO_REAR,
      },
    ],
    va: [
      [1531, 88],
      [2440, 111],
    ],
    fuelLbPerGal: 6,
    sampleEmpty: { weight: 1500, arm: 85.9 },
    defaults: piperDefaults,
  },
  {
    id: 'pa28-161-2325',
    name: 'Piper PA-28-161 Warrior II (2325 lb)',
    manufacturer: 'Piper',
    designation: 'PA-28-161',
    airframe: 'low-wing',
    datum: piperNotes[0],
    source: 'Piper PA-28-161 Warrior II POH (VB-880), Section 6',
    notes: [
      piperNotes[1],
      'For early Warrior IIs certificated at 2325 lb. Later airplanes are 2440 lb.',
      'No ramp weight is used: this handbook lists none, so takeoff limits apply on the ramp.',
    ],
    stations: piperFour,
    groupLimits: [],
    fuelOptions: piperFuel,
    categories: [
      {
        id: 'normal',
        label: 'Normal',
        maxTakeoff: 2325,
        maxLanding: 2325,
        envelope: [
          [83, 1200],
          [83, 1950],
          [87, 2325],
          [93, 2325],
          [93, 1200],
        ],
      },
      {
        id: 'utility',
        label: 'Utility',
        maxTakeoff: 2020,
        maxLanding: 2020,
        envelope: [
          [83, 1200],
          [83, 1950],
          [83.8, 2020],
          [93, 2020],
          [93, 1200],
        ],
        emptyStations: PIPER_NO_REAR,
      },
    ],
    va: [
      [1531, 88],
      [2325, 111],
    ],
    fuelLbPerGal: 6,
    sampleEmpty: { weight: 1467.45, arm: 87.05 },
    defaults: piperDefaults,
  },
];

const byId = new Map(AIRCRAFT.map((m) => [m.id, m]));

export function findModel(id: string): AircraftModel | undefined {
  return byId.get(id);
}

export function getModel(id: string): AircraftModel {
  const model = byId.get(id);
  if (!model) throw new Error(`Unknown aircraft model "${id}"`);
  return model;
}
