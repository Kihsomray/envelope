import type { Evaluation } from '../domain/calc';
import { balanceZone, rangePosition, type BalanceZone } from '../domain/effects';
import { limitsAt } from '../domain/envelope';
import { airframeFor } from './airframes';
import * as fmt from './format';
import { CgSymbol } from './Icon';

/** Bubble radius per sqrt(lb), in inches of airplane. 340 lb reads as a 15 in radius. */
const BUBBLE_SCALE = 0.82;
/** Degrees of tilt at the edge of the CG range. */
const MAX_TILT = 3;

interface Bubble {
  readonly key: string;
  readonly arm: number;
  readonly y: number;
  readonly weight: number;
  readonly kind: 'load' | 'fuel';
}

export const ZONE_COPY: Record<BalanceZone, string> = {
  forward: 'Nose-heavy',
  balanced: 'Well balanced',
  aft: 'Tail-heavy',
};

export function AircraftDiagram({ evaluation }: { evaluation: Evaluation }) {
  const { model, rows, conditions, takeoffLimits, ok } = evaluation;
  const { silhouette: s, scaleX, scaleY } = airframeFor(model);
  const takeoff = conditions.takeoff.point;

  // Over max weight there are no limits at this weight; show the top-of-envelope range.
  const primary = model.categories[0];
  const limits = takeoffLimits ?? limitsAt(primary.envelope, primary.maxTakeoff)!;
  const position = rangePosition(limits, takeoff.arm);
  const tilt = Math.max(-1.6, Math.min(1.6, (position - 0.5) * 2)) * MAX_TILT;
  const pivotX = (limits.forward + limits.aft) / 2;
  const pivotY = s.centerlineY * scaleY;

  const bubbles = groupLoads(rows, s.cabinY * scaleY, s.fuelY * scaleY);

  const minX = s.bounds.minX * scaleX - 8;
  const maxX = s.bounds.maxX * scaleX + 8;
  const top = s.bounds.top * scaleY - 10;
  const bottom = 4;

  const zone = balanceZone(position);

  return (
    <figure class="diagram" aria-label="Side view of the loaded airplane">
      <svg viewBox={`${minX} ${top} ${maxX - minX} ${bottom - top}`} role="img" aria-labelledby="diagram-desc">
        <desc id="diagram-desc">
          {`CG at ${fmt.arm(takeoff.arm)} inches, allowed range ${fmt.arm(limits.forward)} to ${fmt.arm(limits.aft)} inches. ${ZONE_COPY[zone]}.`}
        </desc>
        <g
          class="plane"
          style={{
            transform: `rotate(${tilt}deg)`,
            transformOrigin: `${pivotX}px ${pivotY}px`,
            transformBox: 'view-box',
          }}
        >
          <g transform={`scale(${scaleX} ${scaleY})`}>
            <ellipse class="plane-prop" cx={s.prop.cx} cy={s.prop.cy} rx={2.4} ry={s.prop.ry} />
            {s.struts.map(([x1, y1, x2, y2]) => (
              <line class="plane-strut" x1={x1} y1={y1} x2={x2} y2={y2} stroke-width={3} />
            ))}
            {s.gear.map(({ leg, wheel: [cx, cy, r] }) => (
              <g>
                <path class="plane-gear" d={leg} />
                <circle class="plane-gear" cx={cx} cy={cy} r={r} />
                <circle class="plane-body" cx={cx} cy={cy} r={r * 0.35} />
              </g>
            ))}
            <path class="plane-body" d={s.stabilizer} />
            <path class="plane-body" d={s.fin} />
            <path class="plane-body" d={s.body} />
            <path class="plane-detail" d={s.spinner} />
            {s.glass.map((d) => (
              <path class="plane-glass" d={d} />
            ))}
            <path class="plane-detail" d={s.wing} />
          </g>

          {/* Where the CG may be at this weight, drawn to scale across the cabin. */}
          <rect
            class="cg-slice"
            data-ok={String(ok)}
            x={limits.forward}
            y={s.sliceY[0] * scaleY}
            width={Math.max(limits.aft - limits.forward, 0.5)}
            height={(s.sliceY[1] - s.sliceY[0]) * scaleY}
            rx={1.5}
          />

          {bubbles.map((b) => {
            const r = Math.max(BUBBLE_SCALE * Math.sqrt(b.weight), 2.5);
            return (
              <g key={b.key}>
                <circle class="load-bubble" data-kind={b.kind} cx={b.arm} cy={b.y} r={r} style={{ r }} />
                {r >= 11 && (
                  <text class="load-label" x={b.arm} y={b.y} style={{ fontSize: `${Math.min(r * 0.62, 10)}px` }}>
                    {fmt.weight(b.weight)}
                  </text>
                )}
              </g>
            );
          })}

          <g class="cg-mark" style={{ transform: `translate(${takeoff.arm}px, ${pivotY}px)` }}>
            <CgSymbol size={14} />
          </g>
        </g>

      </svg>
    </figure>
  );
}

function groupLoads(rows: Evaluation['rows'], cabinY: number, fuelY: number): Bubble[] {
  const byArm = new Map<string, Bubble>();
  for (const r of rows) {
    if (r.kind === 'empty' || r.weight <= 0) continue;
    const kind = r.kind === 'fuel' ? 'fuel' : 'load';
    const key = `${kind}:${r.arm}`;
    const prev = byArm.get(key);
    byArm.set(key, {
      key,
      arm: r.arm,
      y: kind === 'fuel' ? fuelY : cabinY,
      weight: (prev?.weight ?? 0) + r.weight,
      kind,
    });
  }
  return [...byArm.values()];
}
