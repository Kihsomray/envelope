import { AIRCRAFT, findModel, getModel } from '../domain/aircraft';
import type { AircraftModel, AircraftProfile, Loading } from '../domain/types';

export interface AppState {
  readonly activeProfileId: string;
  readonly profiles: readonly AircraftProfile[];
  /** Current loading per profile, so switching airplanes keeps each one's numbers. */
  readonly loadings: Readonly<Record<string, Loading>>;
}

export type Action =
  | { type: 'selectProfile'; id: string }
  | { type: 'saveProfile'; profile: AircraftProfile }
  | { type: 'deleteProfile'; id: string }
  | { type: 'setStation'; stationId: string; weight: number }
  | { type: 'setFuel'; field: 'rampFuelGal' | 'taxiFuelGal' | 'tripFuelGal'; gal: number }
  | { type: 'setLoading'; loading: Loading }
  | { type: 'resetLoading' }
  | { type: 'importShared'; profile: AircraftProfile; loading: Loading };

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function sampleProfile(model: AircraftModel, id = newId()): AircraftProfile {
  return {
    id,
    tail: '',
    modelId: model.id,
    fuelOptionId: model.fuelOptions[0]!.id,
    emptyWeight: model.sampleEmpty.weight,
    emptyArm: model.sampleEmpty.arm,
    usesSampleEmpty: true,
  };
}

export function defaultLoading(model: AircraftModel, fuelOptionId: string): Loading {
  const fuel = model.fuelOptions.find((f) => f.id === fuelOptionId) ?? model.fuelOptions[0]!;
  return {
    stations: { ...model.defaults.stations },
    rampFuelGal: fuel.usableGal,
    taxiFuelGal: model.defaults.taxiGal,
    tripFuelGal: model.defaults.tripGal,
  };
}

export function initialState(): AppState {
  const model = AIRCRAFT[0]!;
  const profile = sampleProfile(model);
  return {
    activeProfileId: profile.id,
    profiles: [profile],
    loadings: { [profile.id]: defaultLoading(model, profile.fuelOptionId) },
  };
}

export function activeProfile(state: AppState): AircraftProfile {
  return state.profiles.find((p) => p.id === state.activeProfileId) ?? state.profiles[0]!;
}

export function activeLoading(state: AppState): Loading {
  const profile = activeProfile(state);
  return state.loadings[profile.id] ?? defaultLoading(getModel(profile.modelId), profile.fuelOptionId);
}

export function displayName(profile: AircraftProfile): string {
  return profile.tail.trim() || findModel(profile.modelId)?.designation || 'Aircraft';
}

function updateLoading(state: AppState, update: (l: Loading) => Loading): AppState {
  const profile = activeProfile(state);
  return { ...state, loadings: { ...state.loadings, [profile.id]: update(activeLoading(state)) } };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'selectProfile':
      return state.profiles.some((p) => p.id === action.id) ? { ...state, activeProfileId: action.id } : state;

    case 'saveProfile': {
      const { profile } = action;
      const previous = state.profiles.find((p) => p.id === profile.id);
      const profiles = previous
        ? state.profiles.map((p) => (p.id === profile.id ? profile : p))
        : [...state.profiles, profile];
      const model = getModel(profile.modelId);
      // A model change invalidates the old stations; a new profile needs a first loading.
      const keepLoading = previous && previous.modelId === profile.modelId && state.loadings[profile.id];
      const loading = keepLoading
        ? clampFuel(state.loadings[profile.id]!, model, profile.fuelOptionId)
        : defaultLoading(model, profile.fuelOptionId);
      return {
        activeProfileId: profile.id,
        profiles,
        loadings: { ...state.loadings, [profile.id]: loading },
      };
    }

    case 'deleteProfile': {
      const profiles = state.profiles.filter((p) => p.id !== action.id);
      if (profiles.length === 0) return initialState();
      const { [action.id]: _removed, ...loadings } = state.loadings;
      const activeProfileId = state.activeProfileId === action.id ? profiles[0]!.id : state.activeProfileId;
      return { activeProfileId, profiles, loadings };
    }

    case 'setStation':
      return updateLoading(state, (l) => ({
        ...l,
        stations: { ...l.stations, [action.stationId]: action.weight },
      }));

    case 'setFuel':
      return updateLoading(state, (l) => ({ ...l, [action.field]: action.gal }));

    case 'setLoading':
      return updateLoading(state, () => action.loading);

    case 'resetLoading': {
      const profile = activeProfile(state);
      return updateLoading(state, () => defaultLoading(getModel(profile.modelId), profile.fuelOptionId));
    }

    case 'importShared': {
      const existing = state.profiles.find((p) => sameAirplane(p, action.profile));
      const profile = existing ?? action.profile;
      return {
        activeProfileId: profile.id,
        profiles: existing ? state.profiles : [...state.profiles, profile],
        loadings: { ...state.loadings, [profile.id]: action.loading },
      };
    }
  }
}

/** Switching to smaller tanks shouldn't leave more fuel aboard than they hold. */
function clampFuel(loading: Loading, model: AircraftModel, fuelOptionId: string): Loading {
  const fuel = model.fuelOptions.find((f) => f.id === fuelOptionId) ?? model.fuelOptions[0]!;
  return loading.rampFuelGal > fuel.usableGal ? { ...loading, rampFuelGal: fuel.usableGal } : loading;
}

function sameAirplane(a: AircraftProfile, b: AircraftProfile): boolean {
  return (
    a.modelId === b.modelId &&
    a.fuelOptionId === b.fuelOptionId &&
    a.tail.trim().toUpperCase() === b.tail.trim().toUpperCase() &&
    a.emptyWeight === b.emptyWeight &&
    a.emptyArm === b.emptyArm
  );
}
