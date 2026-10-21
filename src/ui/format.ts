const grouped0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const fixed1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fixed2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const upTo1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/** "2,342" */
export const weight = (lb: number) => grouped0.format(Math.round(lb));
/** "40.48". CG is shown to two places so a point just past a limit never rounds onto it. */
export const arm = (inches: number) => fixed2.format(inches);
/** "94,784" */
export const moment = (lbIn: number) => grouped0.format(Math.round(lbIn));
/** "51.6" */
export const gallons = (gal: number) => upTo1.format(gal);
export const oneDecimal = (n: number) => fixed1.format(n);
/** "+4%" / "-4%" with a real minus sign. */
export const signedPercent = (fraction: number) => {
  const pct = Math.round(fraction * 100);
  return pct === 0 ? '0%' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
};

/** Parse user input like "1,642.5" or " 180 ". Returns null for anything else. */
export function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
