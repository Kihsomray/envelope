import { findModel } from '../domain/aircraft';
import type { AircraftProfile, Loading } from '../domain/types';
import { initialState, newId, type AppState } from './model';

/*
 * Everything that crosses a trust boundary (localStorage, share links) is
 * parsed field by field. Anything malformed is dropped rather than repaired,
 * and a state that fails validation falls back to a clean default.
 */

const STORAGE_KEY = 'envelope:v1';
const SHARE_PARAM = 'load';
const MAX_WEIGHT_LB = 20000;
const MAX_FUEL_GAL = 500;

type Json = unknown;

const isRecord = (v: Json): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v);

const finiteIn = (v: Json, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

export function parseProfile(v: Json): AircraftProfile | null {
  if (!isRecord(v)) return null;
  const { id, tail, modelId, fuelOptionId, emptyWeight, emptyArm, usesSampleEmpty } = v;
  if (typeof modelId !== 'string') return null;
  const model = findModel(modelId);
  if (!model) return null;
  if (!finiteIn(emptyWeight, 1, MAX_WEIGHT_LB) || !finiteIn(emptyArm, -500, 1000)) return null;
  const fuel = model.fuelOptions.find((f) => f.id === fuelOptionId) ?? model.fuelOptions[0]!;
  return {
    id: typeof id === 'string' && id.length > 0 && id.length < 100 ? id : newId(),
    tail: typeof tail === 'string' ? tail.slice(0, 12) : '',
    modelId,
    fuelOptionId: fuel.id,
    emptyWeight,
    emptyArm,
    usesSampleEmpty: usesSampleEmpty === true,
  };
}

export function parseLoading(v: Json, modelId: string): Loading | null {
  const model = findModel(modelId);
  if (!model || !isRecord(v) || !isRecord(v.stations)) return null;
  const stations: Record<string, number> = {};
  for (const s of model.stations) {
    const w = v.stations[s.id];
    if (finiteIn(w, 0, MAX_WEIGHT_LB)) stations[s.id] = w;
  }
  const gal = (x: Json) => (finiteIn(x, 0, MAX_FUEL_GAL) ? x : 0);
  return {
    stations,
    rampFuelGal: gal(v.rampFuelGal),
    taxiFuelGal: gal(v.taxiFuelGal),
    tripFuelGal: gal(v.tripFuelGal),
  };
}

export function parseState(v: Json): AppState | null {
  if (!isRecord(v) || v.version !== 1 || !Array.isArray(v.profiles)) return null;
  const profiles = v.profiles.map(parseProfile).filter((p): p is AircraftProfile => p !== null);
  if (profiles.length === 0) return null;
  const rawLoadings = isRecord(v.loadings) ? v.loadings : {};
  const loadings: Record<string, Loading> = {};
  for (const p of profiles) {
    const l = parseLoading(rawLoadings[p.id], p.modelId);
    if (l) loadings[p.id] = l;
  }
  const activeProfileId = profiles.some((p) => p.id === v.activeProfileId)
    ? (v.activeProfileId as string)
    : profiles[0]!.id;
  return { activeProfileId, profiles, loadings };
}

export function loadState(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): AppState {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return (raw && parseState(JSON.parse(raw))) || initialState();
  } catch {
    return initialState();
  }
}

export function saveState(state: AppState, storage: Pick<Storage, 'setItem'> | undefined = safeStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...state }));
  } catch {
    // Private browsing or a full quota: the app still works, it just won't remember.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

// Share links ---------------------------------------------------------------

interface SharePayload {
  readonly profile: AircraftProfile;
  readonly loading: Loading;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function encodeShare({ profile, loading }: SharePayload): string {
  const { id: _id, ...rest } = profile;
  return toBase64Url(JSON.stringify({ v: 1, p: rest, l: loading }));
}

export function decodeShare(encoded: string): SharePayload | null {
  try {
    const data: Json = JSON.parse(fromBase64Url(encoded));
    if (!isRecord(data) || data.v !== 1) return null;
    const profile = parseProfile({ ...(isRecord(data.p) ? data.p : {}), id: newId() });
    if (!profile) return null;
    const loading = parseLoading(data.l, profile.modelId);
    return loading ? { profile, loading } : null;
  } catch {
    return null;
  }
}

export function shareUrl(payload: SharePayload, base: string): string {
  const url = new URL(base);
  url.hash = `${SHARE_PARAM}=${encodeShare(payload)}`;
  return url.toString();
}

/** Reads a share payload from a location hash like "#load=...". */
export function readShareHash(hash: string): SharePayload | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const encoded = params.get(SHARE_PARAM);
  return encoded ? decodeShare(encoded) : null;
}
