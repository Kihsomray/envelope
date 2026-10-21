import type { AircraftModel } from '../domain/types';

/*
 * Side-view silhouettes, drawn in each family's own station coordinates:
 * x is inches aft of that POH's datum and y is inches above the ground,
 * negated for SVG. Because the drawing shares the datum with the loading
 * data, load stations and the CG land on the right part of the airplane.
 */

export interface Silhouette {
  readonly body: string;
  readonly spinner: string;
  readonly wing: string;
  readonly fin: string;
  readonly stabilizer: string;
  readonly glass: readonly string[];
  readonly struts: readonly (readonly [number, number, number, number])[];
  readonly gear: readonly { readonly leg: string; readonly wheel: readonly [number, number, number] }[];
  readonly prop: { readonly cx: number; readonly cy: number; readonly ry: number };
  readonly bounds: { readonly minX: number; readonly maxX: number; readonly top: number };
  /** Heights (SVG y) at which to draw loads, and the CG symbol below them. */
  readonly cabinY: number;
  readonly fuelY: number;
  readonly centerlineY: number;
  /** Vertical extent of the cabin, for the to-scale CG range slice. */
  readonly sliceY: readonly [top: number, bottom: number];
}

const highWing: Silhouette = {
  body:
    'M-41 -45C-40 -51 -36 -53 -30 -54L-4 -57C2 -58 6 -59 9 -60L30 -81L92 -81L142 -66' +
    'C180 -61 230 -58 288 -55L290 -50C240 -47 180 -42 120 -35C95 -31 70 -29 50 -28' +
    'L5 -29C-10 -30 -25 -32 -33 -36C-38 -39 -41 -42 -41 -45Z',
  spinner: 'M-41 -45C-41 -50 -38 -52.5 -33 -53.2L-33 -36.4C-38 -38 -41 -41 -41 -45Z',
  wing:
    'M24 -84C24 -88 30 -91 44 -91.5C60 -91.5 80 -88 95 -84.5L95 -83C70 -81.5 40 -80.5 30 -80.5' +
    'C26 -80.5 24 -82 24 -84Z',
  fin: 'M190 -60C222 -64 250 -88 266 -104L285 -106C288.5 -106 290 -104 290 -101L292 -56L288 -55Z',
  stabilizer: 'M236 -53.5L291 -54.5L295 -52L238 -50.5Z',
  glass: [
    'M13 -62L29 -78.5L55 -78.5L55 -62Z',
    'M59 -62L59 -78.5L89 -78.5L101 -74L92 -63Z',
    'M98 -79L137 -67.5L130 -66.5L98 -74.5Z',
  ],
  struts: [[58, -33, 44, -81]],
  gear: [
    { leg: 'M-15.5 -32L-11.5 -32L-12 -12L-15 -12Z', wheel: [-13.5, -7, 7] },
    { leg: 'M53 -30L60 -30L71 -10L66.5 -9Z', wheel: [69, -8.5, 8.5] },
  ],
  prop: { cx: -38.5, cy: -45, ry: 37 },
  bounds: { minX: -42, maxX: 295, top: -106 },
  cabinY: -62,
  fuelY: -86,
  centerlineY: -42,
  sliceY: [-82, -27],
};

const lowWing: Silhouette = {
  body:
    'M6 -42C7 -47 10 -49.5 15 -50L44 -53.5C52 -54.5 58 -55.5 62 -56C72 -66 84 -74 98 -77' +
    'L142 -77.5C155 -76 165 -70 178 -62C210 -57 250 -53 300 -50L302 -44C260 -41 210 -35 165 -27' +
    'L70 -24C45 -25 25 -28 15 -33C9 -36 6 -39 6 -42Z',
  spinner: 'M6 -42C6 -47 9 -49.5 14 -50.1L14 -33.6C9 -35 6 -38 6 -42Z',
  wing:
    'M78.4 -27C78.4 -31 85 -33 98 -33C115 -33 132 -30.5 145 -27.5L145 -26.5C130 -24 100 -21.5 88 -21.5' +
    'C82 -21.5 78.4 -23.5 78.4 -27Z',
  fin: 'M214 -56C240 -61 266 -81 280 -91L298 -92C300 -92 301 -90.5 301 -88.5L303 -50L300 -50Z',
  stabilizer: 'M262 -45.5L310 -46.5L312 -44L264 -42.5Z',
  glass: [
    'M66 -58C74 -66 85 -72 97 -74.5L117 -74.5L117 -58Z',
    'M121 -58L121 -74.5L141 -74.5C150 -73 156 -69 160 -64L155 -58Z',
  ],
  struts: [],
  gear: [
    { leg: 'M27.5 -28L31.5 -28L31 -12L28 -12Z', wheel: [29.5, -7, 7] },
    { leg: 'M108 -22L113 -22L114 -11L110 -11Z', wheel: [112, -8.5, 8.5] },
  ],
  prop: { cx: 8.5, cy: -42, ry: 38 },
  bounds: { minX: 5, maxX: 312, top: -92 },
  cabinY: -59,
  fuelY: -27,
  centerlineY: -41,
  sliceY: [-78, -23],
};

export interface Airframe {
  readonly silhouette: Silhouette;
  /** Horizontal scale about x = 0 applied to the silhouette (not to loads). */
  readonly scaleX: number;
  readonly scaleY: number;
}

export function airframeFor(model: AircraftModel): Airframe {
  if (model.airframe === 'low-wing') return { silhouette: lowWing, scaleX: 1, scaleY: 1 };
  // The 152 shares the Skyhawk's lines at about 89 % of its length and 95 % of its height.
  return model.id === 'c152'
    ? { silhouette: highWing, scaleX: 0.89, scaleY: 0.95 }
    : { silhouette: highWing, scaleX: 1, scaleY: 1 };
}
