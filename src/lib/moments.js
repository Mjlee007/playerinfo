import { useSyncExternalStore } from "react";

// Moments people add by hand (funny moments, great/dropped catches...), keyed by match id.
// Works for both seed-series matches and scheduled fixtures. Saved in localStorage (offline-safe).
const KEY = "playerinfo.moments.v1";
const listeners = new Set();
let cache = null;

const read = () => {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    cache = v && typeof v === "object" ? v : {};
  } catch {
    cache = {};
  }
  return cache;
};
const write = (next) => {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or unavailable */
  }
  listeners.forEach((l) => l());
};
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const EMPTY = [];
export const useAllMoments = () => useSyncExternalStore(subscribe, read, read);
export const momentsFor = (all, matchId) => all[matchId] || EMPTY;

export function addMoment(matchId, m) {
  const all = read();
  const item = { ...m, id: `c-${Date.now().toString(36)}`, custom: true, rank: m.kind === "funny" ? 5 : 4, created: Date.now() };
  write({ ...all, [matchId]: [...(all[matchId] || []), item] });
}
export function deleteMoment(matchId, id) {
  const all = read();
  write({ ...all, [matchId]: (all[matchId] || []).filter((m) => m.id !== id) });
}
