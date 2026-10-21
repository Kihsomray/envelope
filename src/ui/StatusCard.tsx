import type { Ref } from 'preact';
import type { Evaluation, Issue } from '../domain/calc';
import { balanceZone, rangePosition } from '../domain/effects';
import type { Fix } from '../domain/fixes';
import type { AircraftProfile } from '../domain/types';
import type { Action } from '../state/model';
import { AircraftDiagram, ZONE_COPY } from './AircraftDiagram';
import { CgGauge } from './CgGauge';
import * as fmt from './format';
import { Icon } from './Icon';

interface Props {
  readonly evaluation: Evaluation;
  readonly fixes: readonly Fix[];
  readonly profile: AircraftProfile;
  readonly dispatch: (a: Action) => void;
  readonly onEditAircraft: () => void;
  readonly heroRef: Ref<HTMLDivElement>;
}

export function StatusCard({ evaluation, fixes, profile, dispatch, onEditAircraft, heroRef }: Props) {
  const { ok, conditions, takeoffLimits, takeoffWeightMargin, primary, model } = evaluation;
  const takeoff = conditions.takeoff.point;
  const landing = conditions.landing.point;
  const issues: Issue[] = [...evaluation.commonIssues, ...primary.issues];
  const limitIssues = issues.filter((i) => i.severity === 'limit');
  const advisories = issues.filter((i) => i.severity === 'advisory');
  const zone = takeoffLimits ? balanceZone(rangePosition(takeoffLimits, takeoff.arm)) : null;
  const isOut = (v: Evaluation['primary']['takeoff']) => !v.ok;

  return (
    <section class="card" aria-labelledby="status-title">
      <div ref={heroRef}>
        <div class="hero-top">
          <h2 class="visually-hidden" id="status-title">
            Weight and balance result
          </h2>
          <div class="status-pill" data-ok={String(ok)} role="status" aria-live="polite">
            <Icon name={ok ? 'checkCircle' : 'xCircle'} />
            {ok ? 'Within limits' : limitIssues.length === 1 ? 'Out of limits' : `${limitIssues.length} limits exceeded`}
          </div>
          <span class="card-subtitle">{primary.category.label} category, at takeoff</span>
        </div>

        <div class="hero-metrics">
          <div>
            <div class="metric-value">
              {fmt.weight(takeoff.weight)}
              <small>lb</small>
            </div>
            <div class="metric-label">
              {takeoffWeightMargin >= 0 ? (
                <>
                  <strong>{fmt.weight(takeoffWeightMargin)} lb</strong> below max {fmt.weight(primary.category.maxTakeoff)}
                </>
              ) : (
                <span class="bad">
                  <strong>{fmt.weight(-takeoffWeightMargin)} lb</strong> over max {fmt.weight(primary.category.maxTakeoff)}
                </span>
              )}
            </div>
          </div>
          <div>
            <div class="metric-value">
              {fmt.arm(takeoff.arm)}
              <small>in</small>
            </div>
            <div class="metric-label">
              {takeoffLimits ? (
                <>
                  CG &middot; limits {fmt.arm(takeoffLimits.forward)} to {fmt.arm(takeoffLimits.aft)}
                </>
              ) : (
                'CG · no limits above max weight'
              )}
            </div>
          </div>
        </div>
      </div>

      {profile.usesSampleEmpty && (
        <div class="notice no-print">
          <Icon name="alert" />
          <div>
            Using the POH sample empty weight ({fmt.weight(profile.emptyWeight)} lb at {fmt.arm(profile.emptyArm)} in). Every
            airplane is different.{' '}
            <button type="button" onClick={onEditAircraft}>
              Enter yours
            </button>
          </div>
        </div>
      )}

      <AircraftDiagram evaluation={evaluation} />
      <div class="diagram-caption">
        <strong>{zone ? ZONE_COPY[zone] : 'Over max weight'}</strong>
        <span>{ok ? 'Green' : 'Red'}: allowed CG range, to scale</span>
      </div>

      {takeoffLimits && (
        <CgGauge
          limits={takeoffLimits}
          takeoffArm={takeoff.arm}
          landingArm={landing.arm}
          ok={ok}
          takeoffOut={isOut(primary.takeoff)}
          landingOut={isOut(primary.landing)}
        />
      )}

      {(limitIssues.length > 0 || advisories.length > 0) && (
        <ul class="issues" aria-label="Problems">
          {[...limitIssues, ...advisories].map((i) => (
            <li class="issue" data-severity={i.severity} key={i.key}>
              <Icon name={i.severity === 'limit' ? 'xCircle' : 'alert'} />
              <span>{i.message}</span>
            </li>
          ))}
        </ul>
      )}

      {fixes.length > 0 && (
        <div class="fixes no-print">
          <h3 class="eyebrow">Ways to fix it</h3>
          <ul>
            {fixes.map((f) => (
              <li class="fix" key={f.key}>
                <span>{f.description}</span>
                <button type="button" class="btn btn-small" onClick={() => dispatch({ type: 'setLoading', loading: f.loading })}>
                  Apply
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!ok && fixes.length === 0 && limitIssues.some((i) => i.key.includes(':forward') || i.key.includes(':aft')) && (
        <p class="card-subtitle" style={{ marginTop: '12px' }}>
          No single change here fixes it. Rearrange people or bags, or check the empty weight for {model.designation}.
        </p>
      )}
    </section>
  );
}
