import type { Evaluation } from '../domain/calc';
import { balanceZone, handlingEffects, maneuveringSpeed, rangePosition, stallSpeedChange } from '../domain/effects';
import { checkPoint } from '../domain/envelope';
import type { ConditionId } from '../domain/types';
import { EnvelopeChart } from './EnvelopeChart';
import * as fmt from './format';
import { Icon } from './Icon';

export function EnvelopeCard({ evaluation }: { evaluation: Evaluation }) {
  const { conditions, model } = evaluation;
  const primary = model.categories[0];
  const rows: ConditionId[] = ['ramp', 'takeoff', 'landing', 'zeroFuel'];

  const statusOf = (id: ConditionId): boolean | null => {
    const p = conditions[id].point;
    if (id === 'zeroFuel') return checkPoint(primary.envelope, p.weight, p.arm).ok;
    if (id === 'ramp') return p.weight <= (primary.maxRamp ?? primary.maxTakeoff) + 1e-9;
    const max = id === 'landing' ? primary.maxLanding : primary.maxTakeoff;
    return p.weight <= max + 1e-9 && checkPoint(primary.envelope, p.weight, p.arm).ok;
  };

  return (
    <section class="card" aria-labelledby="env-title">
      <div class="card-header">
        <h2 class="card-title" id="env-title">
          CG envelope
        </h2>
        <span class="card-subtitle">Tap a point</span>
      </div>
      <EnvelopeChart evaluation={evaluation} />
      <table class="table" style={{ marginTop: '14px' }}>
        <caption class="visually-hidden">Weight and CG at each stage of the flight</caption>
        <thead>
          <tr>
            <th scope="col">Stage</th>
            <th scope="col" class="num">
              Weight
            </th>
            <th scope="col" class="num">
              CG
            </th>
            <th scope="col" class="num">
              Fuel
            </th>
            <th scope="col" class="status-cell">
              <span class="visually-hidden">Status</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((id) => {
            const c = conditions[id];
            const ok = statusOf(id);
            return (
              <tr key={id}>
                <th scope="row" style={{ fontWeight: 500, color: 'var(--text)', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                  {c.label}
                </th>
                <td class="num">{fmt.weight(c.point.weight)} lb</td>
                <td class="num">{fmt.arm(c.point.arm)} in</td>
                <td class="num">{fmt.gallons(c.fuelGal)} gal</td>
                <td class="status-cell">
                  <span class={ok ? 'status-icon-ok' : 'status-icon-bad'}>
                    <Icon name={ok ? 'check' : 'close'} label={ok ? 'Within limits' : 'Out of limits'} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export function FlightCard({ evaluation }: { evaluation: Evaluation }) {
  const { model, conditions, takeoffLimits, secondary, commonIssues } = evaluation;
  const primary = model.categories[0];
  const takeoff = conditions.takeoff.point;
  const landing = conditions.landing.point;
  const position = takeoffLimits ? rangePosition(takeoffLimits, takeoff.arm) : null;
  const zone = position === null ? null : balanceZone(position);
  const vaTakeoff = maneuveringSpeed(model.va, takeoff.weight);
  const vaLanding = maneuveringSpeed(model.va, landing.weight);
  const stall = stallSpeedChange(takeoff.weight, primary.maxTakeoff);
  const commonOk = commonIssues.every((i) => i.severity !== 'limit');

  return (
    <section class="card" aria-labelledby="fly-title">
      <div class="card-header">
        <h2 class="card-title" id="fly-title">
          How it will fly
        </h2>
        {position !== null && (
          <span class="card-subtitle">CG at {Math.round(Math.min(Math.max(position, 0), 1) * 100)}% of range</span>
        )}
      </div>

      <div class="stats">
        <div class="stat">
          <div class="stat-value">
            {Math.round(vaTakeoff)}
            <small>KIAS</small>
          </div>
          <div class="stat-label">
            Va at takeoff weight, {Math.round(vaLanding)} at landing
          </div>
        </div>
        <div class="stat">
          <div class="stat-value">{fmt.signedPercent(stall)}</div>
          <div class="stat-label">Stall speed vs. max weight</div>
        </div>
        {secondary.map((s) => (
          <div class="stat" key={s.category.id}>
            <div class="stat-value" style={{ fontSize: '17px', paddingTop: '3px' }}>
              {s.ok && commonOk ? 'Eligible' : 'Not eligible'}
            </div>
            <div class="stat-label">
              {s.category.label} category{s.ok && commonOk ? `, max ${fmt.weight(s.category.maxTakeoff)} lb` : ''}
            </div>
          </div>
        ))}
        <div class="stat">
          <div class="stat-value">
            {fmt.weight(Math.max(evaluation.takeoffWeightMargin, 0))}
            <small>lb</small>
          </div>
          <div class="stat-label">Payload you could still add</div>
        </div>
      </div>

      {zone && (
        <ul class="effects">
          {handlingEffects(zone).map((e) => (
            <li class="effect" key={e.label}>
              <span class="trend" aria-hidden="true">
                <Icon name={e.trend === 'more' ? 'up' : e.trend === 'less' ? 'down' : 'flat'} />
              </span>
              <span>
                <strong>{e.label}</strong>
                {e.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p class="card-subtitle" style={{ marginTop: '14px' }}>
        Va is interpolated from the POH table. Heavier airplanes stall faster, climb slower and need more runway.
      </p>
    </section>
  );
}

export function LoadsheetCard({ evaluation, onShare, onPrint }: { evaluation: Evaluation; onShare: () => void; onPrint: () => void }) {
  const { rows, conditions, model } = evaluation;
  const density = model.fuelLbPerGal;
  const ramp = conditions.ramp;
  const takeoff = conditions.takeoff;
  const landing = conditions.landing;
  const zf = conditions.zeroFuel;
  const taxiGal = ramp.fuelGal - takeoff.fuelGal;
  const tripGal = takeoff.fuelGal - landing.fuelGal;
  const fuelArm = evaluation.fuel.arm;

  const line = (label: string, weight: number, arm: number | null, moment: number, cls?: string) => (
    <tr class={cls}>
      <td>{label}</td>
      <td class="num">{fmt.weight(weight)}</td>
      <td class="num">{arm === null ? '' : fmt.arm(arm)}</td>
      <td class="num">{fmt.moment(moment)}</td>
    </tr>
  );

  return (
    <section class="card" aria-labelledby="sheet-title">
      <div class="card-header">
        <h2 class="card-title" id="sheet-title">
          Loadsheet
        </h2>
        <div class="btn-row no-print">
          <button type="button" class="btn btn-small" onClick={onShare}>
            <Icon name="share" />
            Share
          </button>
          <button type="button" class="btn btn-small" onClick={onPrint}>
            <Icon name="printer" />
            Print
          </button>
        </div>
      </div>
      <table class="table">
        <caption class="visually-hidden">Loading computation</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col" class="num">
              lb
            </th>
            <th scope="col" class="num">
              Arm
            </th>
            <th scope="col" class="num">
              Moment
            </th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter((r) => r.kind !== 'fuel' && (r.weight > 0 || r.kind === 'empty'))
            .map((r) => line(r.label, r.weight, r.arm, r.moment))}
          {line('Zero fuel weight', zf.point.weight, zf.point.arm, zf.point.moment, 'total')}
          {line(`Fuel, ${fmt.gallons(ramp.fuelGal)} gal`, ramp.fuelGal * density, fuelArm, ramp.fuelGal * density * fuelArm)}
          {line('Ramp weight', ramp.point.weight, ramp.point.arm, ramp.point.moment, 'total')}
          {line(`Taxi & run-up, ${fmt.gallons(taxiGal)} gal`, -taxiGal * density, fuelArm, -taxiGal * density * fuelArm, 'subtle')}
          {line('Takeoff weight', takeoff.point.weight, takeoff.point.arm, takeoff.point.moment, 'total')}
          {line(`Trip burn, ${fmt.gallons(tripGal)} gal`, -tripGal * density, fuelArm, -tripGal * density * fuelArm, 'subtle')}
          {line('Landing weight', landing.point.weight, landing.point.arm, landing.point.moment, 'total')}
        </tbody>
      </table>
    </section>
  );
}
