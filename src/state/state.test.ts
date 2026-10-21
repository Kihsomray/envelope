import { describe, expect, it } from 'vitest';
import { getModel } from '../domain/aircraft';
import { activeLoading, activeProfile, initialState, reducer, sampleProfile } from './model';
import { decodeShare, encodeShare, loadState, parseState, readShareHash, saveState, shareUrl } from './persistence';

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};

describe('reducer', () => {
  it('starts with a 172S sample profile and a full-tank loading', () => {
    const s = initialState();
    expect(activeProfile(s).modelId).toBe('c172s');
    expect(activeProfile(s).usesSampleEmpty).toBe(true);
    expect(activeLoading(s).rampFuelGal).toBe(53);
  });

  it('keeps a separate loading per profile', () => {
    let s = initialState();
    const first = s.activeProfileId;
    s = reducer(s, { type: 'setStation', stationId: 'pilot', weight: 150 });
    const archer = sampleProfile(getModel('pa28-181'), 'archer');
    s = reducer(s, { type: 'saveProfile', profile: archer });
    expect(s.activeProfileId).toBe('archer');
    expect(activeLoading(s).rampFuelGal).toBe(48);
    s = reducer(s, { type: 'selectProfile', id: first });
    expect(activeLoading(s).stations.pilot).toBe(150);
  });

  it('resets the loading when a profile changes model', () => {
    let s = initialState();
    const p = activeProfile(s);
    s = reducer(s, { type: 'setStation', stationId: 'baggage2', weight: 40 });
    s = reducer(s, { type: 'saveProfile', profile: { ...p, modelId: 'pa28-181', fuelOptionId: 'standard' } });
    expect(activeLoading(s).stations.baggage2).toBeUndefined();
  });

  it('clamps fuel when switching to smaller tanks', () => {
    const p = { ...sampleProfile(getModel('c172n'), 'n'), fuelOptionId: 'long-range' };
    let s = reducer(initialState(), { type: 'saveProfile', profile: p });
    expect(activeLoading(s).rampFuelGal).toBe(50);
    s = reducer(s, { type: 'saveProfile', profile: { ...p, fuelOptionId: 'standard' } });
    expect(activeLoading(s).rampFuelGal).toBe(40);
  });

  it('never deletes the last profile without replacing it', () => {
    const s = initialState();
    const next = reducer(s, { type: 'deleteProfile', id: s.activeProfileId });
    expect(next.profiles).toHaveLength(1);
    expect(next.profiles[0]!.id).not.toBe(s.activeProfileId);
  });
});

describe('persistence', () => {
  it('round-trips state through storage', () => {
    const storage = memoryStorage();
    const s = reducer(initialState(), { type: 'setStation', stationId: 'pilot', weight: 201 });
    saveState(s, storage);
    expect(loadState(storage)).toEqual(s);
  });

  it('falls back to defaults on corrupt storage', () => {
    const storage = memoryStorage();
    storage.setItem('envelope:v1', '{not json');
    expect(activeProfile(loadState(storage)).modelId).toBe('c172s');
  });

  it('drops profiles for unknown models and invalid numbers', () => {
    const parsed = parseState({
      version: 1,
      activeProfileId: 'x',
      profiles: [
        { id: 'a', tail: 'N1', modelId: 'concorde', fuelOptionId: 'standard', emptyWeight: 1000, emptyArm: 40 },
        { id: 'b', tail: 'N2', modelId: 'c152', fuelOptionId: 'bogus', emptyWeight: 1136, emptyArm: 29.9 },
        { id: 'c', tail: 'N3', modelId: 'c152', fuelOptionId: 'standard', emptyWeight: 'heavy', emptyArm: 29.9 },
      ],
      loadings: { b: { stations: { pilot: 170, wing: 5, frontPax: -3 }, rampFuelGal: 20 } },
    });
    expect(parsed?.profiles.map((p) => p.id)).toEqual(['b']);
    expect(parsed?.profiles[0]?.fuelOptionId).toBe('standard');
    expect(parsed?.activeProfileId).toBe('b');
    expect(parsed?.loadings.b).toEqual({ stations: { pilot: 170 }, rampFuelGal: 20, taxiFuelGal: 0, tripFuelGal: 0 });
  });
});

describe('share links', () => {
  const profile = { ...sampleProfile(getModel('c172s'), 'p1'), tail: 'N738ZÜ' };
  const loading = { stations: { pilot: 180, baggage1: 20 }, rampFuelGal: 40, taxiFuelGal: 1.4, tripFuelGal: 8 };

  it('round-trips a loading, including non-ASCII text', () => {
    const decoded = decodeShare(encodeShare({ profile, loading }));
    expect(decoded?.loading).toEqual(loading);
    expect(decoded?.profile.tail).toBe('N738ZÜ');
    expect(decoded?.profile.id).not.toBe('p1');
  });

  it('builds and reads a URL hash', () => {
    const url = new URL(shareUrl({ profile, loading }, 'https://example.com/envelope/'));
    expect(url.pathname).toBe('/envelope/');
    expect(readShareHash(url.hash)?.loading).toEqual(loading);
  });

  it('rejects garbage', () => {
    expect(decodeShare('%%%')).toBeNull();
    expect(readShareHash('#load=e30')).toBeNull();
    expect(readShareHash('')).toBeNull();
  });

  it('imports a shared airplane once', () => {
    const shared = decodeShare(encodeShare({ profile, loading }))!;
    let s = reducer(initialState(), { type: 'importShared', ...shared });
    const again = decodeShare(encodeShare({ profile, loading }))!;
    s = reducer(s, { type: 'importShared', ...again });
    expect(s.profiles).toHaveLength(2);
    expect(activeLoading(s)).toEqual(loading);
  });
});
