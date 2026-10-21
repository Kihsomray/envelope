import type { CgLimits } from '../domain/envelope';
import * as fmt from './format';
import { useElementWidth } from './hooks';

interface Props {
  readonly limits: CgLimits;
  readonly takeoffArm: number;
  readonly landingArm: number;
  /** Whether the whole loading is within limits, which colours the zone. */
  readonly ok: boolean;
  /** Each point judged against the envelope at its own weight. */
  readonly takeoffOut: boolean;
  readonly landingOut: boolean;
}

const HEIGHT = 74;
const TRACK_Y = 34;
const TRACK_H = 10;
const SIDE = 14;
/** Labels closer than this (px) are merged into one. */
const LABEL_GAP = 92;

/** A magnified view of the CG range at takeoff weight, where inches matter. */
export function CgGauge({ limits, takeoffArm, landingArm, ok, takeoffOut, landingOut }: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>(340);

  const span = limits.aft - limits.forward;
  const pad = Math.max(span * 0.22, 1.2);
  const lo = Math.min(limits.forward - pad, Math.min(takeoffArm, landingArm) - pad * 0.4);
  const hi = Math.max(limits.aft + pad, Math.max(takeoffArm, landingArm) + pad * 0.4);
  const x = (arm: number) => SIDE + ((arm - lo) / (hi - lo)) * (width - SIDE * 2);

  const xTo = x(takeoffArm);
  const xLdg = x(landingArm);
  const merged = Math.abs(xTo - xLdg) < LABEL_GAP;
  const cy = TRACK_Y + TRACK_H / 2;
  const clampLabel = (px: number) => Math.min(Math.max(px, 46), width - 46);

  return (
    <div class="gauge" ref={ref}>
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={`CG range at takeoff weight: forward limit ${fmt.arm(limits.forward)} inches, aft limit ${fmt.arm(limits.aft)} inches. Takeoff CG ${fmt.arm(takeoffArm)}, landing CG ${fmt.arm(landingArm)}.`}
      >
        <rect class="gauge-track" x={SIDE} y={TRACK_Y} width={width - SIDE * 2} height={TRACK_H} rx={TRACK_H / 2} />
        <rect
          class="gauge-zone"
          data-ok={String(ok)}
          x={x(limits.forward)}
          y={TRACK_Y}
          width={x(limits.aft) - x(limits.forward)}
          height={TRACK_H}
          rx={3}
        />

        <text class="gauge-text" x={x(limits.forward)} y={TRACK_Y + TRACK_H + 17} text-anchor="middle">
          Fwd {fmt.arm(limits.forward)}
        </text>
        <text class="gauge-text" x={x(limits.aft)} y={TRACK_Y + TRACK_H + 17} text-anchor="middle">
          Aft {fmt.arm(limits.aft)}
        </text>

        {Math.abs(xTo - xLdg) > 3 && (
          <line x1={xTo} y1={cy} x2={xLdg} y2={cy} stroke="var(--text)" stroke-width={2} stroke-linecap="round" />
        )}

        <g class="gauge-marker" style={{ transform: `translate(${xLdg}px, ${cy}px)` }}>
          <circle r={6} fill="var(--surface)" stroke={landingOut ? 'var(--critical)' : 'var(--text)'} stroke-width={2} />
        </g>
        <g class="gauge-marker" style={{ transform: `translate(${xTo}px, ${cy}px)` }}>
          <circle r={8} fill="var(--surface)" />
          <circle r={6} fill={takeoffOut ? 'var(--critical)' : 'var(--text)'} />
        </g>

        {merged ? (
          <text class="gauge-text-strong" x={clampLabel((xTo + xLdg) / 2)} y={TRACK_Y - 12} text-anchor="middle">
            T/O {fmt.arm(takeoffArm)} &middot; LDG {fmt.arm(landingArm)}
          </text>
        ) : (
          <>
            <text class="gauge-text-strong" x={clampLabel(xTo)} y={TRACK_Y - 12} text-anchor="middle">
              T/O {fmt.arm(takeoffArm)}
            </text>
            <text class="gauge-text-strong" x={clampLabel(xLdg)} y={TRACK_Y - 12} text-anchor="middle">
              LDG {fmt.arm(landingArm)}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
