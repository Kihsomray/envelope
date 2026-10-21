import { useMemo, useState } from 'preact/hooks';
import type { Evaluation } from '../domain/calc';
import { armRange, checkPoint, weightRange } from '../domain/envelope';
import type { ConditionId } from '../domain/types';
import * as fmt from './format';
import { useElementWidth } from './hooks';

const MARGIN = { top: 16, right: 14, bottom: 40, left: 50 };
/** Points further out than this are pinned to the chart edge rather than squashing the envelope. */
const MAX_OVERSHOOT_IN = 6;
const MAX_OVERSHOOT_LB = 400;
const HIT_RADIUS = 28;

const POINT_ORDER: readonly ConditionId[] = ['zeroFuel', 'landing', 'takeoff'];
const SHORT: Record<ConditionId, string> = { ramp: 'Ramp', takeoff: 'T/O', landing: 'LDG', zeroFuel: 'ZFW' };

/** Round step sizes for axis ticks: 1, 2, 2.5, 5 x 10^n. */
function niceStep(range: number, targetTicks: number): number {
  const raw = range / Math.max(targetTicks, 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

function ticks(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

export function EnvelopeChart({ evaluation }: { evaluation: Evaluation }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(340);
  const [active, setActive] = useState<ConditionId | null>(null);
  const { model, conditions } = evaluation;
  const [primary, ...others] = model.categories;
  const height = Math.round(Math.min(Math.max(width * 0.8, 260), 420));

  const geometry = useMemo(() => {
    const arms = armRange(model.categories.flatMap((c) => c.envelope));
    const weights = weightRange(model.categories.flatMap((c) => c.envelope));
    const pts = POINT_ORDER.map((id) => conditions[id].point);
    const xLo = Math.max(Math.min(arms.min - 1, ...pts.map((p) => p.arm - 0.6)), arms.min - MAX_OVERSHOOT_IN);
    const xHi = Math.min(Math.max(arms.max + 1, ...pts.map((p) => p.arm + 0.6)), arms.max + MAX_OVERSHOOT_IN);
    const topWeight = Math.max(primary.maxRamp ?? primary.maxTakeoff, weights.max);
    const yLo = Math.max(Math.min(weights.min, ...pts.map((p) => p.weight - 40)), weights.min - MAX_OVERSHOOT_LB);
    const yHi = Math.min(Math.max(topWeight + 60, ...pts.map((p) => p.weight + 40)), topWeight + MAX_OVERSHOOT_LB);
    return { xLo, xHi, yLo, yHi };
  }, [model, conditions, primary]);

  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const { xLo, xHi, yLo, yHi } = geometry;
  const sx = (arm: number) => MARGIN.left + ((arm - xLo) / (xHi - xLo)) * plotW;
  const sy = (w: number) => MARGIN.top + (1 - (w - yLo) / (yHi - yLo)) * plotH;
  const clampX = (px: number) => Math.min(Math.max(px, MARGIN.left), MARGIN.left + plotW);
  const clampY = (py: number) => Math.min(Math.max(py, MARGIN.top), MARGIN.top + plotH);

  const xStep = niceStep(xHi - xLo, Math.max(Math.floor(plotW / 56), 3));
  const yStep = niceStep(yHi - yLo, Math.max(Math.floor(plotH / 44), 3));
  const xTicks = ticks(xLo, xHi, xStep);
  const yTicks = ticks(yLo, yHi, yStep);

  const polygon = (env: readonly (readonly [number, number])[]) =>
    env.map(([a, w]) => `${sx(a).toFixed(1)},${sy(w).toFixed(1)}`).join(' ');

  const points = POINT_ORDER.map((id) => {
    const c = conditions[id];
    const maxWeight = id === 'landing' ? primary.maxLanding : primary.maxTakeoff;
    const verdict = checkPoint(primary.envelope, Math.min(c.point.weight, maxWeight), c.point.arm);
    const ok = (id === 'zeroFuel' || c.point.weight <= maxWeight + 1e-9) && verdict.ok;
    return { id, c, ok, px: clampX(sx(c.point.arm)), py: clampY(sy(c.point.weight)) };
  });
  const byId = Object.fromEntries(points.map((p) => [p.id, p])) as Record<(typeof points)[number]['id'], (typeof points)[number]>;
  const to = byId.takeoff;
  const ldg = byId.landing;
  const zf = byId.zeroFuel;

  // Label placement: takeoff to the right, the others to the left, then pushed
  // apart vertically so labels on the same side never overprint.
  const LINE = 13;
  const labels = (() => {
    const placed = points.map((p) => {
      const nearRightEdge = p.px > MARGIN.left + plotW - 44;
      const nearLeftEdge = p.px < MARGIN.left + 44;
      const right = p.id === 'takeoff' ? !nearRightEdge : nearLeftEdge;
      return { id: p.id, ok: p.ok, x: p.px + (right ? 10 : -10), y: p.py + 4, anchor: right ? 'start' : 'end' } as const;
    });
    const out = new Map<ConditionId, { x: number; y: number; anchor: 'start' | 'end'; ok: boolean }>();
    for (const side of ['start', 'end'] as const) {
      const group = placed.filter((l) => l.anchor === side).sort((a, b) => a.y - b.y);
      let lastY = -Infinity;
      for (const l of group) {
        const y = Math.max(l.y, lastY + LINE);
        out.set(l.id, { x: l.x, y, anchor: l.anchor, ok: l.ok });
        lastY = y;
      }
    }
    return out;
  })();

  const onPointer = (e: PointerEvent) => {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best: ConditionId | null = null;
    let bestD = HIT_RADIUS;
    for (const p of points) {
      const d = Math.hypot(p.px - mx, p.py - my);
      if (d < bestD) {
        bestD = d;
        best = p.id;
      }
    }
    setActive(best);
  };

  const tip = active ? byId[active as keyof typeof byId] : undefined;
  const secondary = others[0];

  return (
    <div class="chart" ref={ref}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`CG envelope chart. Takeoff ${fmt.weight(to.c.point.weight)} pounds at ${fmt.arm(to.c.point.arm)} inches, landing ${fmt.weight(ldg.c.point.weight)} pounds at ${fmt.arm(ldg.c.point.arm)} inches. The table below lists every point.`}
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onPointerLeave={() => setActive(null)}
      >
        <g class="grid">
          {yTicks.map((t) => (
            <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={sy(t)} y2={sy(t)} />
          ))}
          {xTicks.map((t) => (
            <line x1={sx(t)} x2={sx(t)} y1={MARGIN.top} y2={MARGIN.top + plotH} />
          ))}
        </g>
        {yTicks.map((t) => (
          <text class="axis-text" x={MARGIN.left - 8} y={sy(t) + 4} text-anchor="end">
            {fmt.weight(t)}
          </text>
        ))}
        {xTicks.map((t) => (
          <text class="axis-text" x={sx(t)} y={MARGIN.top + plotH + 16} text-anchor="middle">
            {Number.isInteger(t) ? t : t.toFixed(1)}
          </text>
        ))}
        <text class="axis-title" x={MARGIN.left + plotW / 2} y={height - 4} text-anchor="middle">
          CG, inches aft of datum
        </text>
        <text class="axis-title" x={12} y={MARGIN.top + plotH / 2} text-anchor="middle" transform={`rotate(-90 12 ${MARGIN.top + plotH / 2})`}>
          Weight, lb
        </text>

        <polygon class="env-primary" points={polygon(primary.envelope)} />
        {secondary && <polygon class="env-secondary" points={polygon(secondary.envelope)} />}
        <EnvelopeLabel x={sx(armRange(primary.envelope).max) - 6} y={sy(weightRange(primary.envelope).min) - 8} text={primary.label} />
        {secondary && (
          <EnvelopeLabel
            x={sx(armRange(secondary.envelope).max) - 4}
            y={sy(weightRange(secondary.envelope).max) - 6}
            text={secondary.label}
          />
        )}

        <line class="burn-line-dry" x1={ldg.px} y1={ldg.py} x2={zf.px} y2={zf.py} />
        <line class="burn-line" x1={to.px} y1={to.py} x2={ldg.px} y2={ldg.py} />

        <path
          d={`M${zf.px} ${zf.py - 5}l5 5-5 5-5-5Z`}
          fill={zf.ok ? 'var(--text-3)' : 'var(--critical)'}
          stroke="var(--surface)"
          stroke-width={2}
        />
        <circle cx={ldg.px} cy={ldg.py} r={6} fill="var(--surface)" stroke={ldg.ok ? 'var(--text)' : 'var(--critical)'} stroke-width={2.5} />
        <circle cx={to.px} cy={to.py} r={6.5} fill={to.ok ? 'var(--text)' : 'var(--critical)'} stroke="var(--surface)" stroke-width={2} />

        {[zf, ldg, to].map((p) => {
          const l = labels.get(p.id)!;
          return (
            <text class="point-label" data-ok={String(l.ok)} x={l.x} y={l.y} text-anchor={l.anchor}>
              {SHORT[p.id]}
            </text>
          );
        })}

        {tip && <circle cx={tip.px} cy={tip.py} r={11} fill="none" stroke="var(--accent)" stroke-width={2} />}
      </svg>

      {tip && (
        <div class="chart-tooltip" style={{ left: `${tip.px}px`, top: `${tip.py}px` }} role="status">
          <strong>{tip.c.label}</strong>
          {fmt.weight(tip.c.point.weight)} lb at {fmt.arm(tip.c.point.arm)} in
          <br />
          {gallonsLine(tip.c.fuelGal)}
        </div>
      )}

      <div class="legend" aria-hidden="true">
        <span>
          <svg viewBox="0 0 16 12">
            <rect x="1" y="1" width="14" height="10" rx="2" fill="color-mix(in srgb, var(--series-1) 12%, transparent)" stroke="var(--series-1)" stroke-width="2" />
          </svg>
          {primary.label} category
        </span>
        {secondary && (
          <span>
            <svg viewBox="0 0 16 12">
              <rect x="1" y="1" width="14" height="10" rx="2" fill="none" stroke="var(--series-2)" stroke-width="2" />
            </svg>
            {secondary.label} category
          </span>
        )}
        <span>
          <svg viewBox="0 0 16 12">
            <line x1="1" y1="6" x2="15" y2="6" stroke="var(--text)" stroke-width="2" stroke-linecap="round" />
          </svg>
          Fuel burn in flight
        </span>
      </div>
    </div>
  );
}

function EnvelopeLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <text class="env-label" x={x} y={y} text-anchor="end">
      {text}
    </text>
  );
}

function gallonsLine(gal: number): string {
  return gal > 0 ? `${fmt.gallons(gal)} gal of fuel` : 'No usable fuel';
}
