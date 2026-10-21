import { useEffect, useRef, useState } from 'preact/hooks';
import { AIRCRAFT, getModel } from '../domain/aircraft';
import type { AircraftProfile } from '../domain/types';
import { displayName, newId, sampleProfile, type Action, type AppState } from '../state/model';
import * as fmt from './format';
import { Icon } from './Icon';

interface Props {
  readonly open: boolean;
  /** Start straight in the editor for this profile id. */
  readonly editId: string | null;
  readonly state: AppState;
  readonly dispatch: (a: Action) => void;
  readonly onClose: () => void;
}

type View = { kind: 'list' } | { kind: 'edit'; profile: AircraftProfile; isNew: boolean };

export function AircraftSheet({ open, editId, state, dispatch, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<View>({ kind: 'list' });

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      const target = editId ? state.profiles.find((p) => p.id === editId) : undefined;
      setView(target ? { kind: 'edit', profile: target, isNew: false } : { kind: 'list' });
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open, editId]);

  const edit = (profile: AircraftProfile, isNew: boolean) => setView({ kind: 'edit', profile, isNew });

  return (
    <dialog
      ref={dialog}
      class="sheet"
      aria-labelledby="sheet-heading"
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === dialog.current) onClose();
      }}
    >
      <div class="sheet-header">
        <h2 class="card-title" id="sheet-heading">
          {view.kind === 'list' ? 'Your aircraft' : view.isNew ? 'Add aircraft' : `Edit ${displayName(view.profile)}`}
        </h2>
        <button type="button" class="icon-button" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <div class="sheet-body">
        {view.kind === 'list' ? (
          <ProfileList
            state={state}
            onSelect={(id) => {
              dispatch({ type: 'selectProfile', id });
              onClose();
            }}
            onEdit={(p) => edit(p, false)}
            onAdd={() => edit(sampleProfile(AIRCRAFT[0]!, newId()), true)}
          />
        ) : (
          <ProfileForm
            key={view.profile.id}
            initial={view.profile}
            isNew={view.isNew}
            canDelete={!view.isNew}
            onCancel={() => (editId ? onClose() : setView({ kind: 'list' }))}
            onSave={(profile) => {
              dispatch({ type: 'saveProfile', profile });
              onClose();
            }}
            onDelete={() => {
              dispatch({ type: 'deleteProfile', id: view.profile.id });
              setView({ kind: 'list' });
            }}
          />
        )}
      </div>
    </dialog>
  );
}

function ProfileList({
  state,
  onSelect,
  onEdit,
  onAdd,
}: {
  state: AppState;
  onSelect: (id: string) => void;
  onEdit: (p: AircraftProfile) => void;
  onAdd: () => void;
}) {
  return (
    <>
      <ul class="profile-list">
        {state.profiles.map((p) => {
          const model = getModel(p.modelId);
          const active = p.id === state.activeProfileId;
          return (
            <li class="profile" data-active={String(active)} key={p.id}>
              <button type="button" class="profile-select" aria-current={active ? 'true' : undefined} onClick={() => onSelect(p.id)}>
                <strong>
                  {displayName(p)}
                  {p.usesSampleEmpty && <span class="badge">Sample data</span>}
                </strong>
                <span>
                  {model.name} &middot; {fmt.weight(p.emptyWeight)} lb empty
                </span>
              </button>
              <button type="button" class="icon-button" style={{ marginRight: '8px' }} onClick={() => onEdit(p)} aria-label={`Edit ${displayName(p)}`}>
                <Icon name="edit" />
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" class="btn" style={{ width: '100%' }} onClick={onAdd}>
        <Icon name="plus" />
        Add aircraft
      </button>
    </>
  );
}

interface Draft {
  tail: string;
  modelId: string;
  fuelOptionId: string;
  weight: string;
  arm: string;
  moment: string;
}

const toDraft = (p: AircraftProfile): Draft => ({
  tail: p.tail,
  modelId: p.modelId,
  fuelOptionId: p.fuelOptionId,
  weight: String(p.emptyWeight),
  arm: String(p.emptyArm),
  moment: String(Number((p.emptyWeight * p.emptyArm).toFixed(2))),
});

function ProfileForm({
  initial,
  isNew,
  canDelete,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: AircraftProfile;
  isNew: boolean;
  canDelete: boolean;
  onSave: (p: AircraftProfile) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [submitted, setSubmitted] = useState(false);
  const model = getModel(draft.modelId);

  const weight = fmt.parseNumber(draft.weight);
  const armValue = fmt.parseNumber(draft.arm);
  const weightError = weight === null || weight <= 0 ? 'Enter the empty weight in pounds.' : null;
  const armError = armValue === null ? 'Enter the empty CG arm in inches.' : null;
  const isSample = weight === model.sampleEmpty.weight && armValue === model.sampleEmpty.arm;

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  // Weight, arm and moment stay consistent: editing one recomputes the third.
  const onWeight = (text: string) => {
    const w = fmt.parseNumber(text);
    const a = fmt.parseNumber(draft.arm);
    set({ weight: text, ...(w !== null && a !== null ? { moment: String(Number((w * a).toFixed(2))) } : {}) });
  };
  const onArm = (text: string) => {
    const w = fmt.parseNumber(draft.weight);
    const a = fmt.parseNumber(text);
    set({ arm: text, ...(w !== null && a !== null ? { moment: String(Number((w * a).toFixed(2))) } : {}) });
  };
  const onMoment = (text: string) => {
    const w = fmt.parseNumber(draft.weight);
    const m = fmt.parseNumber(text);
    set({ moment: text, ...(w !== null && w > 0 && m !== null ? { arm: String(Number((m / w).toFixed(3))) } : {}) });
  };

  // Arms are measured from each model's own datum, so a new model starts from its POH sample.
  const onModel = (modelId: string) => {
    setDraft((d) => ({ ...toDraft(sampleProfile(getModel(modelId), initial.id)), tail: d.tail }));
  };

  const submit = (e: Event) => {
    e.preventDefault();
    setSubmitted(true);
    if (weightError || armError || weight === null || armValue === null) return;
    onSave({
      id: initial.id,
      tail: draft.tail.trim().toUpperCase(),
      modelId: draft.modelId,
      fuelOptionId: draft.fuelOptionId,
      emptyWeight: weight,
      emptyArm: armValue,
      usesSampleEmpty: isSample,
    });
  };

  return (
    <form class="form" onSubmit={submit} noValidate>
      <div class="field">
        <label for="f-model">Model</label>
        <select id="f-model" value={draft.modelId} onChange={(e) => onModel((e.currentTarget as HTMLSelectElement).value)}>
          {AIRCRAFT.map((m) => (
            <option value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <div class="field">
        <label for="f-tail">Tail number</label>
        <input
          id="f-tail"
          value={draft.tail}
          placeholder="N12345"
          autoCapitalize="characters"
          autoComplete="off"
          spellcheck={false}
          maxLength={12}
          onInput={(e) => set({ tail: (e.currentTarget as HTMLInputElement).value })}
        />
      </div>

      {model.fuelOptions.length > 1 && (
        <div class="field">
          <label for="f-fuel">Fuel tanks</label>
          <select id="f-fuel" value={draft.fuelOptionId} onChange={(e) => set({ fuelOptionId: (e.currentTarget as HTMLSelectElement).value })}>
            {model.fuelOptions.map((f) => (
              <option value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <div class="field-row">
          <div class="field">
            <label for="f-weight">Basic empty weight</label>
            <input
              id="f-weight"
              inputMode="decimal"
              value={draft.weight}
              aria-invalid={submitted && weightError ? 'true' : undefined}
              aria-describedby="f-empty-err f-empty-hint"
              onInput={(e) => onWeight((e.currentTarget as HTMLInputElement).value)}
            />
          </div>
          <div class="field">
            <label for="f-arm">Empty CG arm</label>
            <input
              id="f-arm"
              inputMode="decimal"
              value={draft.arm}
              aria-invalid={submitted && armError ? 'true' : undefined}
              aria-describedby="f-empty-err f-empty-hint"
              onInput={(e) => onArm((e.currentTarget as HTMLInputElement).value)}
            />
          </div>
        </div>
        {submitted && (weightError || armError) && (
          <p class="field-error" id="f-empty-err" role="alert" style={{ marginTop: '6px' }}>
            {weightError ?? armError}
          </p>
        )}
      </div>

      <div class="field">
        <label for="f-moment">Empty moment (lb-in)</label>
        <input id="f-moment" inputMode="decimal" value={draft.moment} onInput={(e) => onMoment((e.currentTarget as HTMLInputElement).value)} />
        <p class="field-hint" id="f-empty-hint">
          From the airplane's current weight and balance record. Enter the arm or the moment; the other follows. Include unusable fuel and full oil.
        </p>
      </div>

      {!isSample && (
        <button
          type="button"
          class="btn btn-ghost btn-small"
          style={{ justifySelf: 'start', paddingLeft: 0 }}
          onClick={() => set({ ...toDraft(sampleProfile(model, initial.id)), tail: draft.tail, fuelOptionId: draft.fuelOptionId })}
        >
          Use the POH sample ({fmt.weight(model.sampleEmpty.weight)} lb at {model.sampleEmpty.arm} in)
        </button>
      )}

      <div class="form-actions">
        {canDelete ? (
          <button type="button" class="btn btn-ghost btn-danger" style={{ paddingLeft: 0 }} onClick={onDelete}>
            Delete
          </button>
        ) : (
          <span />
        )}
        <div class="btn-row">
          <button type="button" class="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary">
            {isNew ? 'Add' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  );
}
