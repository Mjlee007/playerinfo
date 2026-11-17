// Real match footage attached to highlights. Videos are big, so they live in IndexedDB on this
// device (they work offline but don't move to other devices). One clip per highlight, with a trim
// (start / end) and the "big moment" time, where the SIX! / OUT! graphic and the replay focus.
import { useEffect, useState } from "react";

const DB = "playerinfo-media";
const STORE = "clips";
const EVENT = "playerinfo-clips";

let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") return reject(new Error("This browser can't store videos."));
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}
const tx = async (mode, fn) => {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error("Storage is full."));
  });
};

// Stable key for a highlight: match + innings + over + kind + title (ids can shift during live scoring).
export const clipKey = (matchId, m) => [matchId || "match", m.inn ?? "", m.over ?? "", m.kind, m.title].join("::");

// { key, blob, name, type, size, start, end, peak, added }
export async function saveClip(clip) {
  navigator.storage?.persist?.().catch(() => {});
  await tx("readwrite", (s) => s.put({ ...clip, added: Date.now() }));
  window.dispatchEvent(new Event(EVENT));
}
export async function updateClip(key, patch) {
  const c = await getClip(key);
  if (c) await saveClip({ ...c, ...patch });
}
export const getClip = (key) => tx("readonly", (s) => s.get(key));
export async function deleteClip(key) {
  await tx("readwrite", (s) => s.delete(key));
  window.dispatchEvent(new Event(EVENT));
}
export const allClipKeys = () => tx("readonly", (s) => s.getAllKeys());

// Keys of all saved clips (re-read when a clip is added or removed).
export function useClipKeys() {
  const [keys, setKeys] = useState(() => new Set());
  useEffect(() => {
    let alive = true;
    const load = () =>
      allClipKeys()
        .then((k) => alive && setKeys(new Set(k || [])))
        .catch(() => {});
    load();
    window.addEventListener(EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, load);
    };
  }, []);
  return keys;
}

export const fmtSize = (n) => (n > 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1e6))} MB`);
export const fmtSec = (s) => {
  const v = Math.max(0, s || 0);
  return `${Math.floor(v / 60)}:${(v % 60).toFixed(1).padStart(4, "0")}`;
};
