import { useEffect, useMemo, useReducer, useState } from 'preact/hooks';
import { getModel } from './domain/aircraft';
import { evaluate } from './domain/calc';
import { findFixes } from './domain/fixes';
import { activeLoading, activeProfile, displayName, reducer } from './state/model';
import { loadState, readShareHash, saveState, shareUrl } from './state/persistence';
import { AircraftSheet } from './ui/AircraftSheet';
import { EnvelopeCard, FlightCard, LoadsheetCard } from './ui/Cards';
import * as fmt from './ui/format';
import { useDebouncedEffect, useScrolledPast } from './ui/hooks';
import { Icon } from './ui/Icon';
import { LoadPanel } from './ui/LoadPanel';
import { StatusCard } from './ui/StatusCard';

const SAVE_DELAY_MS = 250;
const TOAST_MS = 2600;

function boot() {
  const state = loadState();
  const shared = readShareHash(location.hash);
  if (!shared) return { state, toast: null };
  history.replaceState(null, '', location.pathname + location.search);
  return {
    state: reducer(state, { type: 'importShared', ...shared }),
    toast: `Opened shared loading for ${displayName(shared.profile)}`,
  };
}

export function App() {
  const [initial] = useState(boot);
  const [state, dispatch] = useReducer(reducer, initial.state);
  const [sheet, setSheet] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [toast, setToast] = useState<string | null>(initial.toast);
  const [heroRef, scrolledPast] = useScrolledPast<HTMLDivElement>();

  const profile = activeProfile(state);
  const loading = activeLoading(state);
  const model = getModel(profile.modelId);
  const evaluation = useMemo(() => evaluate(model, profile, loading), [model, profile, loading]);
  const fixes = useMemo(() => (evaluation.ok ? [] : findFixes(model, profile, loading)), [evaluation, model, profile, loading]);

  useDebouncedEffect(() => saveState(state), [state], SAVE_DELAY_MS);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    document.title = `${displayName(profile)} · ${evaluation.ok ? 'Within limits' : 'Out of limits'} · Envelope`;
  }, [profile, evaluation.ok]);

  const share = async () => {
    const url = shareUrl({ profile, loading }, location.href);
    const title = `${displayName(profile)} weight and balance`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast('Link copied');
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') setToast('Could not share this link');
    }
  };

  const takeoff = evaluation.conditions.takeoff.point;

  return (
    <div class="app">
      <header class="topbar" data-scrolled={scrolledPast ? '' : undefined}>
        <div class="brand">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="var(--text)" />
            <circle cx="16" cy="16" r="9" fill="var(--surface)" />
            <path d="M16 16V7a9 9 0 0 1 9 9Z" fill="var(--text)" />
            <path d="M16 16v9a9 9 0 0 1-9-9Z" fill="var(--text)" />
          </svg>
          <span>Envelope</span>
        </div>
        <div class="mini-status" data-visible={scrolledPast ? '' : undefined} aria-hidden="true">
          <span class={evaluation.ok ? 'status-icon-ok' : 'status-icon-bad'} style={{ display: 'inline-flex', width: '16px' }}>
            <Icon name={evaluation.ok ? 'checkCircle' : 'xCircle'} />
          </span>
          {fmt.weight(takeoff.weight)} lb &middot; {fmt.arm(takeoff.arm)} in
        </div>
        <button type="button" class="aircraft-button" onClick={() => setSheet({ open: true, editId: null })} aria-haspopup="dialog">
          {displayName(profile)}
          {profile.tail.trim() && <small>{model.designation}</small>}
          <Icon name="chevronDown" />
        </button>
      </header>

      <main class="layout">
        <div class="col-visual stack">
          <StatusCard
            evaluation={evaluation}
            fixes={fixes}
            profile={profile}
            dispatch={dispatch}
            heroRef={heroRef}
            onEditAircraft={() => setSheet({ open: true, editId: profile.id })}
          />
          <EnvelopeCard evaluation={evaluation} />
        </div>
        <div class="col-inputs stack">
          <LoadPanel evaluation={evaluation} loading={loading} dispatch={dispatch} />
          <FlightCard evaluation={evaluation} />
          <LoadsheetCard evaluation={evaluation} onShare={share} onPrint={() => window.print()} />
        </div>
      </main>

      <footer class="footer">
        <p>
          <strong>{model.name}</strong> &middot; data from the {model.source}. Datum: {model.datum}
        </p>
        <ul>
          {model.notes.map((n) => (
            <li>{n}</li>
          ))}
        </ul>
        <p>
          A planning aid, not a replacement for the POH or the airplane's own weight and balance record. The pilot in
          command is responsible for verifying weight and balance before every flight.
        </p>
      </footer>

      <AircraftSheet
        open={sheet.open}
        editId={sheet.editId}
        state={state}
        dispatch={dispatch}
        onClose={() => setSheet({ open: false, editId: null })}
      />

      {toast && (
        <div class="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
