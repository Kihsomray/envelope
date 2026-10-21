import type { Evaluation } from '../domain/calc';
import { sanitize } from '../domain/calc';
import type { Loading, Station } from '../domain/types';
import type { Action } from '../state/model';
import * as fmt from './format';
import { NumberField } from './NumberField';

const SEAT_SLIDER_MAX = 300;

interface Props {
  readonly evaluation: Evaluation;
  readonly loading: Loading;
  readonly dispatch: (a: Action) => void;
}

export function LoadPanel({ evaluation, loading, dispatch }: Props) {
  const { model, fuel } = evaluation;
  const seats = model.stations.filter((s) => s.kind === 'seat');
  const baggage = model.stations.filter((s) => s.kind === 'baggage');
  const setStation = (stationId: string) => (weight: number) => dispatch({ type: 'setStation', stationId, weight });

  return (
    <section class="card" aria-labelledby="load-title">
      <div class="card-header">
        <h2 class="card-title" id="load-title">
          Load
        </h2>
        <button type="button" class="btn btn-ghost btn-small no-print" onClick={() => dispatch({ type: 'resetLoading' })}>
          Reset
        </button>
      </div>

      <div class="group" role="group" aria-labelledby="g-people">
        <div class="group-header">
          <h3 class="eyebrow" id="g-people">
            People
          </h3>
        </div>
        {seats.map((s) => (
          <StationInput key={s.id} station={s} value={sanitize(loading.stations[s.id])} sliderMax={SEAT_SLIDER_MAX} onChange={setStation(s.id)} />
        ))}
      </div>

      <div class="group" role="group" aria-labelledby="g-baggage">
        <div class="group-header">
          <h3 class="eyebrow" id="g-baggage">
            Baggage
          </h3>
          {model.groupLimits.map((g) => {
            const total = g.stationIds.reduce((sum, id) => sum + sanitize(loading.stations[id]), 0);
            return (
              <span class="group-meter" data-over={String(total > g.maxWeight)}>
                {fmt.weight(total)} of {fmt.weight(g.maxWeight)} lb combined
              </span>
            );
          })}
        </div>
        {baggage.map((s) => (
          <StationInput key={s.id} station={s} value={sanitize(loading.stations[s.id])} sliderMax={s.maxWeight ?? 200} onChange={setStation(s.id)} />
        ))}
      </div>

      <div class="group" role="group" aria-labelledby="g-fuel">
        <div class="group-header">
          <h3 class="eyebrow" id="g-fuel">
            Fuel
          </h3>
          <span class="group-meter">{fmt.gallons(model.fuelLbPerGal)} lb/gal avgas</span>
        </div>

        <div class="station">
          <div class="station-row">
            <label for="fuel-ramp">
              <div class="station-name">Fuel at engine start</div>
              <div class="station-meta" data-over={String(loading.rampFuelGal > fuel.usableGal)}>
                {fmt.weight(loading.rampFuelGal * model.fuelLbPerGal)} lb &middot; arm {fmt.oneDecimal(fuel.arm)} in &middot; {fmt.gallons(fuel.usableGal)} usable
              </div>
            </label>
            <NumberField
              id="fuel-ramp"
              label="Fuel at engine start, gallons"
              value={loading.rampFuelGal}
              decimals={1}
              unit="gal"
              invalid={loading.rampFuelGal > fuel.usableGal}
              onChange={(gal) => dispatch({ type: 'setFuel', field: 'rampFuelGal', gal })}
            />
          </div>
          <Slider
            label="Fuel at engine start"
            value={loading.rampFuelGal}
            max={fuel.usableGal}
            step={0.5}
            onChange={(gal) => dispatch({ type: 'setFuel', field: 'rampFuelGal', gal })}
          />
          <div class="chips">
            {[{ label: 'Full', gal: fuel.usableGal }, ...(fuel.presets ?? []), { label: 'Half', gal: fuel.usableGal / 2 }].map((p) => (
              <button
                type="button"
                class="chip"
                aria-pressed={Math.abs(loading.rampFuelGal - p.gal) < 0.05}
                onClick={() => dispatch({ type: 'setFuel', field: 'rampFuelGal', gal: p.gal })}
              >
                {p.label} &middot; {fmt.gallons(p.gal)}
              </button>
            ))}
          </div>
        </div>

        <div class="fuel-plan">
          <div class="station-row">
            <label class="station-name" for="fuel-taxi">
              Taxi &amp; run-up
            </label>
            <NumberField
              id="fuel-taxi"
              label="Taxi and run-up fuel, gallons"
              value={loading.taxiFuelGal}
              decimals={1}
              unit="gal"
              onChange={(gal) => dispatch({ type: 'setFuel', field: 'taxiFuelGal', gal })}
            />
          </div>
          <div class="station-row">
            <label class="station-name" for="fuel-trip">
              Trip burn
            </label>
            <NumberField
              id="fuel-trip"
              label="Trip fuel burn, gallons"
              value={loading.tripFuelGal}
              decimals={1}
              unit="gal"
              onChange={(gal) => dispatch({ type: 'setFuel', field: 'tripFuelGal', gal })}
            />
          </div>
        </div>
        <p class="fuel-summary">
          Takeoff with {fmt.gallons(evaluation.conditions.takeoff.fuelGal)} gal, land with {fmt.gallons(evaluation.conditions.landing.fuelGal)} gal.
        </p>
      </div>
    </section>
  );
}

function StationInput({
  station,
  value,
  sliderMax,
  onChange,
}: {
  station: Station;
  value: number;
  sliderMax: number;
  onChange: (lb: number) => void;
}) {
  const id = `st-${station.id}`;
  const over = station.maxWeight !== undefined && value > station.maxWeight;
  return (
    <div class="station">
      <div class="station-row">
        <label for={id}>
          <div class="station-name">{station.label}</div>
          <div class="station-meta" id={`${id}-meta`} data-over={String(over)}>
            arm {fmt.oneDecimal(station.arm)} in
            {station.maxWeight !== undefined && <> &middot; max {fmt.weight(station.maxWeight)} lb</>}
          </div>
        </label>
        <NumberField id={id} label={`${station.label}, pounds`} value={value} unit="lb" max={9999} invalid={over} describedBy={`${id}-meta`} onChange={onChange} />
      </div>
      <Slider label={station.label} value={value} max={Math.max(sliderMax, value)} step={1} onChange={onChange} />
    </div>
  );
}

function Slider({
  label,
  value,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const pct = max > 0 ? Math.min(value / max, 1) * 100 : 0;
  return (
    <input
      class="slider no-print"
      type="range"
      min={0}
      max={max}
      step={step}
      value={value}
      // The number field beside it is the accessible control; this is a touch shortcut.
      aria-hidden="true"
      tabIndex={-1}
      title={label}
      style={{ '--pct': `${pct}%` }}
      onInput={(e) => onChange(Number((e.currentTarget as HTMLInputElement).value))}
    />
  );
}
