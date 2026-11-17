// The umpire in the 3D highlights: name + look, saved on this device.
const KEY = "playerinfo.umpire.v1";
export function readUmpire() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { name: "Umpire", look: {} };
  } catch {
    return { name: "Umpire", look: {} };
  }
}
export function saveUmpire(u) {
  try {
    localStorage.setItem(KEY, JSON.stringify(u));
  } catch {
    /* private mode */
  }
}
