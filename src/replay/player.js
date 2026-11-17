// A rigged cricketer built from code: pelvis â†’ spine â†’ chest â†’ neck â†’ head, shoulders â†’ elbows
// â†’ hands, hips â†’ knees â†’ ankles. Poses are joint-angle sets blended over time; running is a
// procedural gait; arms can be solved with 2-bone IK so hands really hold the bat or meet the
// ball. The character faces +z; +x is the character's left.
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { DRIVE_ORDER, findBones } from "./models.js";
import { BODY_MATS, BONE_ORDER, bodyGeometry } from "./body.js";
import { defaultLook, lookKey } from "./look.js";
import { detailNormal } from "./textures.js";

// shared fabric weave normal maps (one per tiling)
let FABRIC = null;
const fabric = () => (FABRIC ||= { shirt: detailNormal("fabric", [10, 5]), limb: detailNormal("fabric", [4, 6]) });
// cloth: soft sheen like a polyester kit + weave
const cloth = (color, normal, rough = 0.72) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: rough, sheen: 0.28, sheenRoughness: 0.6, sheenColor: new THREE.Color("#d8dde6"), normalMap: normal, normalScale: new THREE.Vector2(0.35, 0.35) });
// skin: a warm sheen fakes light scattering under the skin
const skinMat = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, sheen: 0.35, sheenRoughness: 0.8, sheenColor: new THREE.Color("#ff8a6a"), ...extra });
// hard plastic with a lacquer (helmets, shoes)
const gloss = (color, rough = 0.35) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, clearcoat: 1, clearcoatRoughness: 0.08 });

const DOWN = new THREE.Vector3(0, -1, 0);
const LEN = { thigh: 0.44, shin: 0.43, foot: 0.08, upper: 0.29, fore: 0.3 };
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const mat = (color, roughness = 0.75) => new THREE.MeshStandardMaterial({ color, roughness });
const rngOf = (seed) => {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
};
const SKIN = ["#f1c7a3", "#e0ac84", "#c68a5e", "#a8714a", "#8d5a3b", "#6b4429"];
const HAIR = ["#1b1410", "#2b1d14", "#3b2a1c", "#111111", "#4a3426"];

// ---------- poses (joint â†’ [x, y, z] radians) ----------
const LEGS = (th, kn, spread = 0.1) => ({ thL: [th, 0, spread], knL: [kn], thR: [th, 0, -spread], knR: [kn] });
export const POSES = {
  stand: {},
  ready: { chest: [0.32], head: [-0.25], ...LEGS(-0.35, 0.75, 0.14), shL: [-0.55, 0, 0.18], elL: [-0.6], shR: [-0.55, 0, -0.18], elR: [-0.6] },
  keeper: { chest: [0.45], head: [-0.5], ...LEGS(-1.35, 2.15, 0.38), shL: [-0.95, 0, -0.08], elL: [-0.35], shR: [-0.95, 0, 0.08], elR: [-0.35] },
  keeperUp: { chest: [0.25], ...LEGS(-0.4, 0.6, 0.2), shL: [-1.2, 0, -0.1], elL: [-0.4], shR: [-1.2, 0, 0.1], elR: [-0.4] },
  slip: { chest: [0.55], head: [-0.55], ...LEGS(-0.6, 1.0, 0.25), shL: [-0.9, 0, -0.1], elL: [-0.3], shR: [-0.9, 0, 0.1], elR: [-0.3] },
  umpire: { chest: [0.12], ...LEGS(-0.12, 0.25, 0.06), shL: [-0.35, 0, -0.28], elL: [-1.15], shR: [-0.35, 0, 0.28], elR: [-1.15] },
  celebrate: { chest: [-0.12], head: [-0.3], shL: [-2.95, 0, 0.35], elL: [-0.2], shR: [-2.95, 0, -0.35], elR: [-0.2] },
  fistPump: { chest: [0.1], shR: [-2.4, 0, -0.25], elR: [-1.6], shL: [0.2, 0, 0.15], elL: [-0.5] },
  airplane: { chest: [0.2, 0, 0.15], shL: [0, 0, 1.5], elL: [-0.05], shR: [0, 0, -1.5], elR: [-0.05] },
  appeal: { chest: [-0.22], head: [-0.4], shL: [-2.75, 0, 0.55], elL: [-0.15], shR: [-2.75, 0, -0.55], elR: [-0.15], thL: [-0.3, 0, 0.1], knL: [0.3] },
  handsHead: { chest: [0.18], head: [0.35], shL: [-2.55, 0, 0.95], elL: [-2.1], shR: [-2.55, 0, -0.95], elR: [-2.1] },
  dejected: { chest: [0.25], head: [0.55], shL: [0.08, 0, 0.06], elL: [-0.1], shR: [0.08, 0, -0.06], elR: [-0.1] },
  squat: { chest: [0.6], head: [0.5], ...LEGS(-1.6, 2.4, 0.25), shL: [-2.4, 0, 0.9], elL: [-2.1], shR: [-2.4, 0, -0.9], elR: [-2.1] },
  clap: { shL: [-1.0, 0, -0.3], elL: [-1.35], shR: [-1.0, 0, 0.3], elR: [-1.35] },
  throwCock: { pelvis: [0, -0.5, 0], chest: [0, -0.6, 0], shR: [2.4, 0, -0.3], elR: [-1.6], shL: [-1.5, 0, 0.5], elL: [-0.2], thL: [-0.55], knL: [0.2], thR: [0.35], knR: [0.35] },
  throwRelease: { pelvis: [0, 0.35, 0], chest: [0.45, 0.55, 0], shR: [4.98, 0, -0.1], elR: [-0.1], shL: [0.4, 0, 0.3], elL: [-0.6], thL: [-0.45], knL: [0.1], thR: [0.5], knR: [0.6] },
  pickup: { chest: [1.15], head: [-0.75], thL: [-1.0, 0, 0.1], knL: [1.4], thR: [0.15, 0, -0.1], knR: [1.1], shR: [-0.9, 0, 0.05], elR: [-0.15], shL: [-0.5, 0, 0.3], elL: [-0.5] },
  catchHigh: { head: [-0.7], chest: [-0.15], shL: [-2.85, 0, 0.12], elL: [-0.35], shR: [-2.85, 0, -0.12], elR: [-0.35] },
  catchLow: { chest: [0.55], head: [-0.3], ...LEGS(-0.6, 1.0, 0.2), shL: [-0.9, 0, -0.25], elL: [-0.6], shR: [-0.9, 0, 0.25], elR: [-0.6] },
  dive: { head: [-0.2], shL: [-2.9, 0, 0.15], elL: [-0.1], shR: [-2.9, 0, -0.15], elR: [-0.1], thL: [0.15, 0, 0.15], knL: [0.5], thR: [-0.25, 0, -0.05], knR: [0.4] },
  lyingBack: { head: [-0.4], shL: [-2.0, 0, 1.1], elL: [-0.4], shR: [-2.0, 0, -1.1], elR: [-0.4], thL: [-1.2], knL: [0.4], thR: [-0.8], knR: [0.9] },
  // umpire signals
  umpOut: { chest: [0.05], ...LEGS(-0.1, 0.2, 0.06), shR: [-3.05, 0, -0.06], elR: [0], shL: [0.05, 0, 0.08], elL: [-0.15] },
  umpSix: { ...LEGS(-0.1, 0.2, 0.06), shL: [-3.05, 0, 0.12], elL: [0], shR: [-3.05, 0, -0.12], elR: [0] },
  umpWide: { ...LEGS(-0.1, 0.2, 0.06), shL: [0, 0, 1.55], elL: [0], shR: [0, 0, -1.55], elR: [0] },
  umpNoBall: { ...LEGS(-0.1, 0.2, 0.06), shR: [0, 0, -1.55], elR: [0], shL: [0.05, 0, 0.08], elL: [-0.2] },
  umpFour: { ...LEGS(-0.1, 0.2, 0.06), shR: [-1.57, 0, -0.4], elR: [0], shL: [0.05, 0, 0.08], elL: [-0.2] },
  umpFreeHit: { ...LEGS(-0.1, 0.2, 0.06), shR: [-2.9, 0, -0.3], elR: [-0.2], shL: [0.05, 0, 0.08], elL: [-0.2] },
  umpBye: { ...LEGS(-0.1, 0.2, 0.06), shR: [-3.0, 0, -0.1], elR: [0], shL: [0.05, 0, 0.08], elL: [-0.2] },
  // batting (body faces the off side, bowler is at +x)
  batStance: { spine: [0.1], chest: [0.28], thL: [-0.12, 0, 0.2], knL: [0.32], thR: [-0.12, 0, -0.12], knR: [0.32] },
  batBackLift: { spine: [0.05], chest: [0.2, -0.15, 0.05], thL: [-0.12, 0, 0.22], knL: [0.32], thR: [-0.1, 0, -0.12], knR: [0.3] },
  batDrive: { pelvis: [0, 0.1, -0.06], spine: [0.15], chest: [0.35, 0.15, -0.28], thL: [-0.25, 0, 0.62], knL: [0.8], thR: [0.12, 0, -0.2], knR: [0.2] },
  batFollow: { pelvis: [0, 0.35, -0.05], chest: [0.15, 0.6, -0.15], thL: [-0.22, 0, 0.58], knL: [0.55], thR: [0.15, 0, -0.18], knR: [0.45] },
  batLoft: { pelvis: [0, 0.4, 0], chest: [0.0, 0.75, -0.05], thL: [-0.2, 0, 0.5], knL: [0.4], thR: [0.15, 0, -0.2], knR: [0.5] },
  batBack: { pelvis: [0, -0.15, 0.06], chest: [0.08, 0.1, 0.18], thL: [-0.05, 0, 0.18], knL: [0.22], thR: [-0.08, 0, -0.38], knR: [0.4] },
  batPullFollow: { pelvis: [0, 0.7, 0.05], chest: [0.0, 1.0, 0.1], thL: [0, 0, 0.25], knL: [0.25], thR: [-0.1, 0, -0.35], knR: [0.4] },
  batDefend: { spine: [0.15], chest: [0.45, 0.05, -0.25], head: [0.25], thL: [-0.25, 0, 0.5], knL: [0.85], thR: [0.12, 0, -0.15], knR: [0.3] },
  batLeave: { chest: [0.2, -0.2, 0], thL: [-0.1, 0, 0.25], knL: [0.35], thR: [-0.1, 0, -0.15], knR: [0.35] },
  batRaise: { chest: [-0.1], head: [-0.3], shR: [-2.9, 0, -0.2], elR: [-0.1], shL: [-2.6, 0, 0.4], elL: [-0.3] },
  // bowling action (right-arm over)
  bowlBound: { chest: [-0.05, -0.3, 0], thL: [-1.15], knL: [1.5], thR: [0.35], knR: [0.7], shL: [-2.8, 0, 0.2], elL: [-0.4], shR: [-2.4, 0, -0.25], elR: [-0.9] },
  bowlCoil: { pelvis: [0, -0.75, 0], chest: [-0.18, -0.65, 0], shL: [-2.75, 0, 0.3], elL: [-0.2], shR: [0.5, 0, -0.3], elR: [-0.15], thL: [-0.95, 0, 0.05], knL: [1.1], thR: [0.12], knR: [0.35] },
  bowlRelease: { pelvis: [0, 0.15, 0], chest: [0.32, 0.35, 0.05], shL: [0.45, 0, 0.45], elL: [-1.2], shR: [3.25, 0, -0.12], elR: [0], thL: [-0.55, 0, 0.04], knL: [0.05], thR: [0.55], knR: [0.75] },
  bowlFollow: { pelvis: [0, 0.6, 0], chest: [0.7, 0.8, 0], shR: [5.55, 0, 0.35], elR: [-0.3], shL: [0.65, 0, 0.3], elL: [-0.6], thL: [-0.25], knL: [0.45], thR: [0.65], knR: [1.0] },
};
const JOINTS = ["pelvis", "spine", "chest", "neck", "head", "shL", "elL", "shR", "elR", "thL", "knL", "thR", "knR"];
const REST = { shL: [0.05, 0, 0.1], elL: [-0.15], shR: [0.05, 0, -0.1], elR: [-0.15], knL: [0.04], knR: [0.04] };

const angleLerp = (a, b, w) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * w;
};
const get = (p, j) => {
  const v = (typeof p === "string" ? POSES[p] : p)?.[j] || REST[j] || [0, 0, 0];
  return [v[0] || 0, v[1] || 0, v[2] || 0];
};
// list: pose name | pose object | [[pose, weight], ...]
export function blendPoses(list) {
  const items = Array.isArray(list) ? list : [[list, 1]];
  const out = {};
  for (const j of JOINTS) {
    let acc = null;
    let wsum = 0;
    for (const [p, w] of items) {
      if (w <= 0) continue;
      const v = get(p, j);
      if (!acc) acc = v;
      else {
        const k = w / (wsum + w);
        acc = acc.map((a, i) => angleLerp(a, v[i], k));
      }
      wsum += w;
    }
    out[j] = acc || get("stand", j);
  }
  return out;
}

// ---------- kit textures ----------
// The torso is a lathe: u = 0 (and 1) is the middle of the chest, 0.25 the left side, 0.5 the back.
const lum = (c) => {
  const k = new THREE.Color(c);
  return 0.2126 * k.r + 0.7152 * k.g + 0.0722 * k.b;
};
// lettering colour: the trim colour when it stands out on the shirt, otherwise white / near-black
const contrast = (bg, pref) => (Math.abs(lum(bg) - lum(pref)) > 0.28 ? pref : lum(bg) > 0.55 ? "#111827" : "#ffffff");
const edgeOf = (shirt) => new THREE.Color(shirt).offsetHSL(0, 0, lum(shirt) > 0.5 ? -0.35 : -0.2).getStyle();
const canvasTexture = (c, aniso = 8) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
};
function fitText(g, text, maxW, size, weight = "900") {
  let px = size;
  do g.font = `italic ${weight} ${px}px "Arial Black", Arial, sans-serif`;
  while (g.measureText(text).width > maxW && (px -= 2) > 10);
}
// name + number as on a TV kit (on the code-built torso, and as a decal on real models)
function drawBack(g, cx, top, w, { name, number, ink, edge }) {
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.fillStyle = ink;
  g.strokeStyle = edge;
  if (name) {
    const t = String(name).toUpperCase().slice(0, 14);
    fitText(g, t, w * 0.82, Math.round(w * 0.13), "800");
    g.lineWidth = Math.max(3, w * 0.012);
    g.strokeText(t, cx, top + w * 0.1);
    g.fillText(t, cx, top + w * 0.1);
  }
  if (number !== "" && number !== undefined && number !== null) {
    fitText(g, String(number), w * 0.8, Math.round(w * 0.52), "900");
    g.lineWidth = Math.max(4, w * 0.02);
    g.strokeText(String(number), cx, top + w * 0.47);
    g.fillText(String(number), cx, top + w * 0.47);
  }
}
function shirtCanvas({ shirt = "#ff7a2e", trim = "#1e293b", number = "", name = "", code = "", team = "" }) {
  const W = 1024;
  const H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const ink = contrast(shirt, trim);
  const edge = edgeOf(shirt);
  // base with soft fabric shading: lighter chest / back, darker sides
  const grd = g.createLinearGradient(0, 0, W, 0);
  const dark = new THREE.Color(shirt).offsetHSL(0, 0, -0.1).getStyle();
  const light = new THREE.Color(shirt).offsetHSL(0, 0, 0.04).getStyle();
  [[0, light], [0.25, dark], [0.5, light], [0.75, dark], [1, light]].forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  // sublimated stripes
  g.globalAlpha = 0.07;
  g.strokeStyle = "#ffffff";
  g.lineWidth = 10;
  for (let x = -H; x < W; x += 46) {
    g.beginPath();
    g.moveTo(x, H);
    g.lineTo(x + H * 0.6, H * 0.4);
    g.stroke();
  }
  g.globalAlpha = 1;
  // side panels in the trim colour
  const pin = new THREE.Color(trim).offsetHSL(0, 0, 0.15).getStyle();
  for (const u of [0.25, 0.75]) {
    g.fillStyle = trim;
    g.fillRect(u * W - 34, 120, 68, H - 120);
    g.fillStyle = pin;
    g.fillRect(u * W - 34, 120, 8, H - 120);
    g.fillRect(u * W + 26, 120, 8, H - 120);
  }
  // shoulder band + V-neck at the front (drawn on both sides of the seam)
  g.fillStyle = trim;
  g.fillRect(0, 0, W, 22);
  const vee = (x, w, d, col) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x - w, 0);
    g.lineTo(x, d);
    g.lineTo(x + w, 0);
    g.closePath();
    g.fill();
  };
  for (const x of [0, W]) {
    vee(x, 62, 92, trim);
    vee(x, 44, 70, "#ffffff");
    vee(x, 36, 60, new THREE.Color(shirt).offsetHSL(0, 0, -0.22).getStyle());
  }
  // front: team name across the chest
  const label = String(team || code || "").toUpperCase();
  if (label) {
    g.save();
    g.textAlign = "center";
    g.textBaseline = "middle";
    fitText(g, label, 236, 54);
    g.lineWidth = 6;
    g.lineJoin = "round";
    g.strokeStyle = edge;
    g.fillStyle = ink;
    for (const x of [0, W]) {
      g.strokeText(label, x, 196);
      g.fillText(label, x, 196);
    }
    g.restore();
  }
  // crest on the left chest, maker's mark on the right
  if (code) {
    const bx = 0.085 * W;
    const by = 118;
    g.fillStyle = trim;
    g.beginPath();
    g.moveTo(bx - 26, by - 30);
    g.lineTo(bx + 26, by - 30);
    g.lineTo(bx + 26, by + 6);
    g.quadraticCurveTo(bx + 24, by + 28, bx, by + 38);
    g.quadraticCurveTo(bx - 24, by + 28, bx - 26, by + 6);
    g.closePath();
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = "#ffffff";
    g.stroke();
    g.fillStyle = "#ffffff";
    g.font = "bold 19px Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(code.slice(0, 3), bx, by);
    g.fillStyle = ink;
    g.beginPath();
    g.arc(W - bx, by, 12, 0, Math.PI * 2);
    g.fill();
  }
  // back: name + number
  drawBack(g, W / 2, 78, 380, { name, number, ink, edge });
  return canvasTexture(c);
}
// transparent name + number for a real model's back
function backDecal(opts) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  drawBack(c.getContext("2d"), 256, 10, 500, opts);
  return canvasTexture(c);
}
// team crest on the helmet
function badgeCanvas(code, trim) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = trim;
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = "#f5d76e";
  g.stroke();
  g.fillStyle = "#ffffff";
  g.font = "bold 40px Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(code || "").slice(0, 3), 64, 66);
  return canvasTexture(c, 4);
}
// Painted face. On the head sphere u = 0.25 is the front and v = 0.5 the equator.
function faceCanvas(skin, hair, r, beard = "none", eye = "#3b2416", brows = "medium") {
  const W = 512;
  const H = 256;
  const c = document.createElement("canvas");
  c.width = W * 2; // drawn at 2x for sharp close-ups
  c.height = H * 2;
  const g = c.getContext("2d");
  g.scale(2, 2);
  const base = new THREE.Color(skin);
  g.fillStyle = skin;
  g.fillRect(0, 0, W, H);
  const fx = W * 0.25;
  const shade = (x, y, rx, ry, col, a) => {
    const R = Math.max(rx, ry);
    const rg = g.createRadialGradient(x, y, 0, x, y, R);
    rg.addColorStop(0, col);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    g.save();
    g.globalAlpha = a;
    g.translate(x, y);
    g.scale(rx / R, ry / R);
    g.translate(-x, -y);
    g.fillStyle = rg;
    g.fillRect(x - R, y - R, R * 2, R * 2);
    g.restore();
  };
  const deep = base.clone().offsetHSL(0, 0.05, -0.22).getStyle();
  const warm = base.clone().offsetHSL(-0.01, 0.15, -0.05).getStyle();
  // eye sockets, cheeks, stubble
  shade(fx - 30, 118, 22, 12, deep, 0.55);
  shade(fx + 30, 118, 22, 12, deep, 0.55);
  shade(fx - 38, 146, 20, 16, warm, 0.5);
  shade(fx + 38, 146, 20, 16, warm, 0.5);
  if (beard === "goatee") shade(fx, 176, 16, 14, new THREE.Color(hair).lerp(base, 0.2).getStyle(), 0.85);
  else if (beard !== "none" && beard !== "moustache") shade(fx, 170, 54, 26, new THREE.Color(hair).lerp(base, beard === "stubble" ? 0.45 : 0.2).getStyle(), beard === "stubble" ? 0.6 : 0.85);
  if (["moustache", "short", "full", "goatee"].includes(beard)) shade(fx, 153, 17, 5, hair, 0.9);
  shade(fx, 136, 9, 18, deep, 0.45);
  for (const s of [-1, 1]) {
    const ex = fx + s * 29;
    g.fillStyle = "#f3eee6";
    g.beginPath();
    g.ellipse(ex, 120, 11, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = eye;
    g.beginPath();
    g.arc(ex - s, 120, 4.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#0c0705";
    g.beginPath();
    g.arc(ex - s, 120, 2.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.fillRect(ex - s + 1, 118, 1.6, 1.6);
    g.strokeStyle = "#1a100a";
    g.lineWidth = 2.4;
    g.beginPath();
    g.ellipse(ex, 121, 12, 6, 0, Math.PI * 1.05, Math.PI * 1.95);
    g.stroke();
    g.strokeStyle = hair;
    g.lineWidth = brows === "thick" ? 6.5 : brows === "thin" ? 2.8 : 4.5;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(ex - s * 12, 105);
    g.quadraticCurveTo(ex, 100, ex + s * 13, 104);
    g.stroke();
  }
  g.fillStyle = base.clone().offsetHSL(0, 0, -0.35).getStyle();
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(fx + s * 5, 147, 3, 1.8, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = base.clone().offsetHSL(-0.02, 0.18, -0.16).getStyle();
  g.beginPath();
  g.moveTo(fx - 15, 160);
  g.quadraticCurveTo(fx - 5, 154, fx, 157);
  g.quadraticCurveTo(fx + 5, 154, fx + 15, 160);
  g.quadraticCurveTo(fx, 168, fx - 15, 160);
  g.fill();
  g.strokeStyle = base.clone().offsetHSL(0, 0, -0.4).getStyle();
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(fx - 15, 160);
  g.quadraticCurveTo(fx, 162, fx + 15, 160);
  g.stroke();
  // skin grain
  const img = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 10;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  return canvasTexture(c, 4);
}

// ---------- head: face, nose, ears, hair style, beard ----------
const hashText = (s) => {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};
function part(parent, geo, material, pos = [0, 0, 0], rot, scale) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) m.scale.set(...scale);
  m.castShadow = true;
  parent.add(m);
  return m;
}
// roughen a sphere's surface (curly hair, full beard)
function bumpy(geo, r, amount) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + (r() - 0.5) * amount);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
function buildHead(G, L, m, r) {
  // skull with the painted face, jaw + chin, ears, brow ridge, nose
  const shape = {
    oval: { skull: [0.97, 1.14, 1.08], jaw: [1.02, 0.85, 1.0] },
    round: { skull: [1.03, 1.08, 1.08], jaw: [1.1, 0.82, 1.02] },
    square: { skull: [1.0, 1.1, 1.06], jaw: [1.16, 0.88, 1.0] },
    long: { skull: [0.95, 1.22, 1.06], jaw: [0.98, 0.98, 1.0] },
    slim: { skull: [0.92, 1.16, 1.04], jaw: [0.92, 0.88, 0.98] },
  }[L.faceShape] || { skull: [0.97, 1.14, 1.08], jaw: [1.02, 0.85, 1.0] };
  part(G, new THREE.SphereGeometry(0.105, 40, 28), m.face, [0, 0.11, 0], null, shape.skull);
  part(G, new THREE.SphereGeometry(0.08, 20, 14), m.skin, [0, L.faceShape === "long" ? 0.047 : 0.055, 0.02], null, shape.jaw);
  part(G, new THREE.SphereGeometry(0.03, 12, 8), m.skin, [0, 0.035, 0.078], null, [1.2, 0.9, 0.9]);
  for (const s of [1, -1]) {
    part(G, new THREE.SphereGeometry(0.022, 12, 8), m.skin, [s * 0.102, 0.105, -0.005], null, [0.55, 1.05, 0.95]);
    part(G, new THREE.SphereGeometry(0.022, 10, 6), m.skin, [s * 0.035, 0.143, 0.088], null, [1.3, 0.4, 0.6]);
    part(G, new THREE.SphereGeometry(0.02, 10, 8), m.skin, [s * 0.05, 0.075, 0.07], null, [1, 0.8, 0.8]); // cheekbones
  }
  const ns = { small: 0.8, medium: 1, large: 1.25 }[L.nose] || 1;
  part(G, new THREE.BoxGeometry(0.016, 0.05, 0.028), m.skin, [0, 0.112, 0.104], [-0.32, 0, 0], [ns, 1, ns]);
  part(G, new THREE.SphereGeometry(0.0145, 10, 8), m.skin, [0, 0.09, 0.116 + (ns - 1) * 0.01], null, [1.25 * ns, 0.95 * ns, ns]);

  // hair (spikes and curls are flattened under a cap or helmet)
  const h = L.capped && (L.hair === "spiky" || L.hair === "curly") ? "short" : L.hair;
  if (h === "short" || h === "long") {
    part(G, new THREE.SphereGeometry(0.108, 24, 14, 0, TAU, 0, 1.45), m.hair, [0, 0.125, -0.006], null, [1.02, 1.1, 1.06]);
    for (const s of [1, -1]) part(G, new THREE.BoxGeometry(0.012, 0.04, 0.025), m.hair, [s * 0.1, 0.105, 0.03]); // sideburns
  }
  if (h === "long") {
    part(G, new THREE.SphereGeometry(0.1, 20, 14, Math.PI * 0.6, Math.PI * 0.8, 0.9, 1.5), m.hair, [0, 0.11, -0.02], null, [1.08, 1.35, 1.1]);
  }
  if (h === "buzz") {
    const buzz = new THREE.MeshStandardMaterial({ color: new THREE.Color(L.hairColor).lerp(new THREE.Color(L.skin), 0.35), roughness: 0.95 });
    part(G, new THREE.SphereGeometry(0.1065, 24, 14, 0, TAU, 0, 1.4), buzz, [0, 0.122, -0.004], null, [0.99, 1.1, 1.06]);
  }
  if (h === "curly") {
    part(G, bumpy(new THREE.SphereGeometry(0.118, 22, 14, 0, TAU, 0, 1.5), r, 0.12), m.hair, [0, 0.13, -0.01], null, [1.04, 1.05, 1.06]);
  }
  if (h === "spiky") {
    part(G, new THREE.SphereGeometry(0.106, 24, 14, 0, TAU, 0, 1.4), m.hair, [0, 0.124, -0.006], null, [1.01, 1.08, 1.05]);
    for (let i = 0; i < 26; i++) {
      const a = r() * TAU;
      const t = 0.15 + r() * 0.75;
      const dir = new THREE.Vector3(Math.sin(a) * Math.sin(t), Math.cos(t), Math.cos(a) * Math.sin(t));
      const spike = part(G, new THREE.ConeGeometry(0.018, 0.06, 5), m.hair, [dir.x * 0.105, 0.125 + dir.y * 0.115, dir.z * 0.11 - 0.006]);
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
  }
  if (h === "bald") {
    part(G, new THREE.TorusGeometry(0.098, 0.014, 6, 20, Math.PI), m.hair, [0, 0.105, -0.01], [Math.PI / 2, 0, Math.PI], [1, 1.05, 1]);
  }

  // beard (3D for short / full; stubble and moustache are painted on the face)
  if (L.beard === "short" || L.beard === "full") {
    const full = L.beard === "full";
    const geo = new THREE.SphereGeometry(0.085, 22, 14, Math.PI * 0.08, Math.PI * 0.84, Math.PI * 0.52, Math.PI * (full ? 0.42 : 0.34));
    if (full) bumpy(geo, r, 0.08);
    // phi 0.08π..0.92π is the front half (z > 0); theta below the equator is the jaw
    part(G, geo, m.hair, [0, full ? 0.066 : 0.068, 0.018], null, full ? [1.04, 1.04, 1.05] : [1.0, 0.9, 1.0]);
    part(G, new THREE.BoxGeometry(0.046, 0.009, 0.01), m.hair, [0, 0.077, 0.1], [0.15, 0, 0]); // moustache
  }
  if (L.beard === "goatee") {
    part(G, new THREE.SphereGeometry(0.024, 12, 10), m.hair, [0, 0.03, 0.082], null, [1.1, 1.3, 0.8]);
    part(G, new THREE.BoxGeometry(0.046, 0.009, 0.01), m.hair, [0, 0.077, 0.1], [0.15, 0, 0]);
  }
  if (L.beard === "moustache") part(G, new THREE.BoxGeometry(0.048, 0.01, 0.01), m.hair, [0, 0.077, 0.1], [0.15, 0, 0]);
}

// helmet for batters / keepers, a cap, sun hat or headband for fielders, the umpire's hat
function buildHeadwear(G, L, m, role) {
  const gear = (geo, mat, pos, rot, scale) => {
    const x = part(G, geo, mat, pos, rot, scale);
    x.userData.gear = true;
    return x;
  };
  if (role === "batter" || role === "keeper") {
    const hm = L.helmetColor === "team" ? m.helmet : m.gear;
    gear(new THREE.SphereGeometry(0.13, 24, 14, 0, TAU, 0, 1.75), hm, [0, 0.13, -0.005], null, [1, 1.04, 1.12]);
    gear(new THREE.BoxGeometry(0.2, 0.014, 0.085), hm, [0, 0.165, 0.13], [-0.22, 0, 0]);
    for (const y of [0.035, 0.07, 0.105]) gear(new THREE.TorusGeometry(0.118, 0.0055, 4, 18, Math.PI), m.grille, [0, y, 0.01], [0, 0, Math.PI], [1, 1, 1.08]);
    gear(new THREE.BoxGeometry(0.006, 0.09, 0.006), m.grille, [0, 0.07, 0.135]);
    gear(new THREE.BoxGeometry(0.16, 0.06, 0.02), hm, [0, 0.03, -0.12]);
    gear(new THREE.CircleGeometry(0.024, 20), m.badge, [0, 0.215, 0.124], [-0.62, 0, 0]);
    return;
  }
  const hat = role === "umpire" ? L.umpireHat : L.headwear;
  const cm = role === "umpire" ? m.hat : L.capColor === "team" ? m.cap : m.gear;
  if (hat === "umpire") {
    gear(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 28), m.hat, [0, 0.2, 0]);
    gear(new THREE.CylinderGeometry(0.108, 0.118, 0.1, 20), m.hat, [0, 0.25, 0]);
    gear(new THREE.CylinderGeometry(0.119, 0.119, 0.02, 20), m.frame, [0, 0.215, 0]);
  } else if (hat === "cap" || hat === "capBack") {
    const back = hat === "capBack";
    gear(new THREE.SphereGeometry(0.115, 22, 10, 0, TAU, 0, Math.PI / 2), cm, [0, 0.135, 0], null, [1, 0.9, 1.08]);
    gear(new THREE.BoxGeometry(0.17, 0.01, 0.11), cm, [0, 0.14, back ? -0.13 : 0.13], [back ? 0.1 : -0.1, 0, 0]);
    gear(new THREE.SphereGeometry(0.012, 8, 6), cm, [0, 0.238, 0]);
    if (role !== "umpire") gear(new THREE.CircleGeometry(0.022, 18), m.badge, [0, 0.19, back ? -0.105 : 0.105], [back ? 0.45 : -0.45, back ? Math.PI : 0, 0]);
  } else if (hat === "floppy") {
    gear(new THREE.SphereGeometry(0.116, 22, 10, 0, TAU, 0, Math.PI / 2), cm, [0, 0.13, 0], null, [1, 0.85, 1.06]);
    gear(new THREE.CylinderGeometry(0.2, 0.17, 0.03, 28, 1, true), cm, [0, 0.135, 0]);
    gear(new THREE.TorusGeometry(0.119, 0.008, 6, 24), m.frame, [0, 0.15, 0], [Math.PI / 2, 0, 0]);
  } else if (hat === "headband") {
    gear(new THREE.CylinderGeometry(0.112, 0.112, 0.03, 24, 1, true), cm, [0, 0.165, -0.004], null, [1, 1, 1.07]);
  }
}
const LENS = { dark: ["#1a1a1a", 0.3, 0.9], mirrorBlue: ["#3b82f6", 0.35, 0.92], mirrorGold: ["#f59e0b", 0.35, 0.92], clear: ["#dbeafe", 0.05, 0.25] };
function buildGlasses(G, L, m) {
  if (!L.glasses || L.glasses === "none") return;
  const [col, metal, op] = LENS[L.lens] || LENS.dark;
  m.lens.color.set(col);
  m.lens.metalness = metal;
  m.lens.opacity = op;
  const y = 0.126;
  if (L.glasses === "sports") {
    // one curved wraparound lens
    part(G, new THREE.CylinderGeometry(0.112, 0.112, 0.034, 28, 1, true, -1.15, 2.3), m.lens, [0, y, -0.006], null, [1, 1, 1.02]);
    part(G, new THREE.CylinderGeometry(0.113, 0.113, 0.008, 28, 1, true, -1.15, 2.3), m.frame, [0, y + 0.019, -0.006], null, [1, 1, 1.02]);
  } else {
    const round = L.glasses === "round";
    for (const sx of [1, -1]) {
      const lens = part(G, round ? new THREE.CircleGeometry(0.019, 20) : new THREE.CircleGeometry(0.022, 20), m.lens, [sx * 0.036, y, 0.11], [0, sx * 0.18, 0], round ? null : [1.05, 0.85, 1]);
      lens.material = m.lens;
      part(G, new THREE.TorusGeometry(round ? 0.019 : 0.022, 0.0025, 6, 20), m.frame, [sx * 0.036, y, 0.111], [0, sx * 0.18, 0], round ? null : [1.05, 0.85, 1]);
      part(G, new THREE.BoxGeometry(0.003, 0.003, 0.1), m.frame, [sx * 0.102, y + 0.004, 0.06]);
    }
    part(G, new THREE.BoxGeometry(0.024, 0.003, 0.003), m.frame, [0, y + 0.008, 0.113]);
  }
}

// ---------- the player ----------
export class Player {
  constructor({ role = "fielder", seed = 1, headgear = true } = {}) {
    const r = rngOf(seed);
    this.role = role;
    const batter = role === "batter";
    const keeper = role === "keeper";
    const umpire = role === "umpire";
    this.root = new THREE.Group();
    this.tilt = new THREE.Group(); // falls / dives rotate around the feet
    this.root.add(this.tilt);

    const skin = SKIN[Math.floor(r() * SKIN.length)];
    this.m = {
      shirt: cloth("#ffffff", fabric().shirt, 0.7),
      sleeve: cloth("#ff7a2e", fabric().limb, 0.7), // plain colour: the printed shirt texture would wrap onto the arms
      trousers: cloth("#1e293b", fabric().limb, 0.8),
      skin: skinMat(skin),
      face: skinMat("#ffffff", { roughness: 0.48 }),
      trim: mat("#1e293b", 0.6),
      badge: new THREE.MeshStandardMaterial({ roughness: 0.4, transparent: true, alphaTest: 0.5 }),
      pad: cloth("#f4f4f0", fabric().limb, 0.6),
      shoe: gloss("#f2f2f2", 0.45),
      sole: mat("#2a2a2a", 0.8),
      helmet: gloss("#1b2a4a", 0.3),
      grille: new THREE.MeshStandardMaterial({ color: "#c7ccd4", roughness: 0.3, metalness: 0.7 }),
      cap: cloth("#ff7a2e", fabric().limb, 0.75),
      glove: cloth("#f4f4f0", fabric().limb, 0.6),
      hair: mat(HAIR[Math.floor(r() * HAIR.length)], 0.9),
      eye: mat("#ffffff", 0.4),
      pupil: mat("#1a120c", 0.3),
      dark: mat("#2b1d14", 0.8),
      hat: mat("#f4f4ef", 0.7),
      shoeAccent: mat("#1e293b", 0.6),
      gear: gloss("#111827", 0.4), // custom-coloured cap / helmet
      frame: new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.35, metalness: 0.5 }),
      lens: new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.08, metalness: 0.9, transparent: true, opacity: 0.85 }),
      band: mat("#ffffff", 0.9),
    };
    // gear stays visible when a real character model replaces the body
    const gear = new Set([this.m.pad, this.m.helmet, this.m.grille, this.m.cap, this.m.hat, this.m.glove, this.m.badge]);
    const add = (parent, geo, material, pos = [0, 0, 0], rot, scale) => {
      const mesh = new THREE.Mesh(geo, material);
      if (gear.has(material)) mesh.userData.gear = true;
      mesh.position.set(...pos);
      if (rot) mesh.rotation.set(...rot);
      if (scale) mesh.scale.set(...scale);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    // ---- joints (groups). Rest pose = every joint unrotated: arms hang, legs straight. ----
    this.pelvis = new THREE.Group();
    this.pelvis.position.y = 0.99;
    this.tilt.add(this.pelvis);
    const leg = (side) => {
      const th = new THREE.Group();
      th.position.set(side * 0.095, -0.04, 0);
      this.pelvis.add(th);
      const kn = new THREE.Group();
      kn.position.y = -LEN.thigh;
      th.add(kn);
      if (batter || keeper) {
        add(kn, new THREE.CapsuleGeometry(0.085, 0.42, 4, 12), this.m.pad, [0, -0.2, 0.055], null, [1.05, 1, 0.62]);
        add(kn, new THREE.CylinderGeometry(0.078, 0.078, 0.17, 14), this.m.pad, [0, 0.02, 0.075], [0, 0, Math.PI / 2]);
        for (const x of [-0.045, 0, 0.045]) add(kn, new THREE.BoxGeometry(0.014, 0.42, 0.012), this.m.pad, [x, -0.2, 0.112]);
      }
      const an = new THREE.Group();
      an.position.y = -LEN.shin;
      kn.add(an);
      // shoe: rounded toe, heel, sole, a stripe
      add(an, new THREE.BoxGeometry(0.098, 0.07, 0.2), this.m.shoe, [0, -0.035, 0.02]);
      add(an, new THREE.SphereGeometry(0.05, 14, 10), this.m.shoe, [0, -0.045, 0.12], null, [0.98, 0.62, 1.1]);
      add(an, new THREE.BoxGeometry(0.104, 0.022, 0.29), this.m.sole, [0, -0.076, 0.045]);
      add(an, new THREE.BoxGeometry(0.1, 0.014, 0.12), this.m.shoeAccent, [0, -0.02, 0.03], [0.5, 0, 0]);
      return { th, kn, an };
    };
    this.legL = leg(1);
    this.legR = leg(-1);
    this.spine = new THREE.Group();
    this.spine.position.y = 0.08;
    this.pelvis.add(this.spine);
    this.chest = new THREE.Group();
    this.chest.position.y = 0.14;
    this.spine.add(this.chest);
    this.neck = new THREE.Group();
    this.neck.position.y = 0.42;
    this.chest.add(this.neck);
    this.head = new THREE.Group();
    this.head.position.y = 0.08;
    this.neck.add(this.head);
    const H = this.head;
    // face, hair and beard live here and are rebuilt by setLook()
    this.headLook = new THREE.Group();
    H.add(this.headLook);
    // helmet / cap / hat and glasses live here and are rebuilt by setLook()
    this.headGear = new THREE.Group();
    H.add(this.headGear);
    this.showHeadgear = headgear;
    const arm = (side) => {
      const sh = new THREE.Group();
      sh.position.set(side * 0.2, 0.35, 0);
      this.chest.add(sh);
      const el = new THREE.Group();
      el.position.y = -LEN.upper;
      sh.add(el);
      const hand = new THREE.Group();
      hand.position.y = -0.27;
      el.add(hand);
      if (batter) {
        add(hand, new THREE.CapsuleGeometry(0.05, 0.05, 4, 12), this.m.glove, [0, -0.045, 0.004], null, [1.05, 1, 0.82]);
        add(hand, new THREE.CylinderGeometry(0.036, 0.04, 0.05, 12), this.m.glove, [0, 0.0, 0]);
      } else if (keeper) add(hand, new THREE.SphereGeometry(0.08, 14, 12), this.m.glove, [0, -0.05, 0.01], null, [1, 1.15, 0.75]);
      else {
        // palm + fingers + thumb
        add(hand, new THREE.BoxGeometry(0.06, 0.07, 0.026), this.m.skin, [0, -0.045, 0.002]);
        add(hand, new THREE.CapsuleGeometry(0.013, 0.05, 3, 8), this.m.skin, [0, -0.1, 0.006], null, [2.1, 1, 1]);
        add(hand, new THREE.CapsuleGeometry(0.011, 0.035, 3, 8), this.m.skin, [side * -0.03, -0.045, 0.02], [0.4, 0, side * 0.5]);
      }
      let finger = null;
      if (umpire && side === -1) {
        finger = add(hand, new THREE.CapsuleGeometry(0.0095, 0.065, 4, 8), this.m.skin, [0.008, -0.105, 0.012]);
        finger.visible = false;
      }
      // wristband holder (setLook)
      const wrist = new THREE.Group();
      wrist.position.y = 0.035;
      hand.add(wrist);
      return { sh, el, hand, finger, wrist };
    };
    this.armL = arm(1);
    this.armR = arm(-1);

    // ---- the skinned body (rebuilt by setLook) ----
    this.root.updateMatrixWorld(true);
    const bones = [this.pelvis, this.spine, this.chest, this.neck, this.head, this.armL.sh, this.armL.el, this.armL.hand, this.armR.sh, this.armR.el, this.armR.hand, this.legL.th, this.legL.kn, this.legL.an, this.legR.th, this.legR.kn, this.legR.an];
    this.restJoints = Object.fromEntries(BONE_ORDER.map((k, i) => [k, this.tilt.worldToLocal(bones[i].getWorldPosition(new THREE.Vector3()))]));
    this.body = new THREE.SkinnedMesh(new THREE.BufferGeometry(), BODY_MATS.map((k) => this.m[k]));
    this.body.castShadow = true;
    this.body.frustumCulled = false;
    this.tilt.add(this.body);
    this.root.updateMatrixWorld(true);
    this.body.bind(new THREE.Skeleton(bones));
    this.lookKey = "";
    this.setLook(defaultLook(`player-${seed}`));

    // bat
    if (batter) {
      this.bat = new THREE.Group();
      const grip = mat("#1f2937", 0.9);
      const willow = mat("#e8d09b", 0.55);
      const handle = add(this.bat, new THREE.CylinderGeometry(0.017, 0.017, 0.3, 10), grip, [0, -0.15, 0]);
      handle.castShadow = true;
      add(this.bat, new THREE.BoxGeometry(0.108, 0.56, 0.038), willow, [0, -0.58, 0]);
      add(this.bat, new THREE.BoxGeometry(0.06, 0.48, 0.026), willow, [0, -0.56, -0.026]);
      add(this.bat, new THREE.BoxGeometry(0.109, 0.06, 0.039), this.m.cap, [0, -0.37, 0]);
      this.root.add(this.bat);
    }

    this.kitKey = "";
    this.len = { ...LEN, palm: 0, lift: 0.04 };
    this.model = null;
  }

  // Cap / helmet / shoe stripe / wristbands: the team's colours, or the look's own.
  applyGearColors() {
    const L = this.look || {};
    const k = this.kitColors || { shirt: "#ff7a2e", trim: "#1e293b" };
    const role = this.role;
    const custom = role === "batter" || role === "keeper" ? L.helmetColor : L.capColor;
    if (custom && custom !== "team") this.m.gear.color.set(custom);
    this.m.shoeAccent.color.set(!L.shoeAccent || L.shoeAccent === "team" ? k.trim : L.shoeAccent);
    this.m.band.color.set(!L.wristbands || L.wristbands === "team" ? k.shirt : L.wristbands === "none" ? "#ffffff" : L.wristbands);
  }

  // Skin, hair, beard, height and build (see look.js). Rebuilds the body and the face.
  setLook(look) {
    const L = { ...defaultLook(`player-${this.role}`), ...(look || {}) };
    const key = lookKey(L);
    if (key === this.lookKey) return;
    this.lookKey = key;
    this.look = L;
    this.root.scale.setScalar((L.height || 178) / 178);
    this.m.skin.color.set(L.skin);
    this.m.hair.color.set(L.hairColor);
    const old = this.body.geometry;
    this.body.geometry = bodyGeometry(this.restJoints, L, this.role);
    old.dispose();
    for (const c of [...this.headLook.children]) {
      c.geometry?.dispose();
      this.headLook.remove(c);
    }
    this.m.face.map?.dispose();
    this.m.face.map = faceCanvas(L.skin, L.hairColor, rngOf(hashText(key)), L.beard, L.eyeColor, L.brows);
    this.m.face.needsUpdate = true;
    const hat = this.role === "umpire" ? L.umpireHat : this.role === "batter" || this.role === "keeper" ? "helmet" : L.headwear;
    const capped = this.showHeadgear && ["helmet", "cap", "capBack", "floppy", "umpire"].includes(hat);
    buildHead(this.headLook, { ...L, capped }, this.m, rngOf(hashText(key) + 7));
    for (const c of [...this.headGear.children]) {
      c.geometry?.dispose();
      this.headGear.remove(c);
    }
    if (this.showHeadgear) buildHeadwear(this.headGear, L, this.m, this.role);
    buildGlasses(this.headLook, L, this.m);
    for (const arm of [this.armL, this.armR]) {
      for (const c of [...arm.wrist.children]) {
        c.geometry?.dispose();
        arm.wrist.remove(c);
      }
      if (L.wristbands !== "none" && this.role !== "umpire") {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.034, 0.055, 16), this.m.band);
        band.castShadow = true;
        arm.wrist.add(band);
      }
    }
    this.m.shoe.color.set(L.shoes);
    this.applyGearColors();
    if (this.model) {
      this.body.visible = false;
      this.headLook.visible = false;
    }
  }

  // Replace the code-built body with a real rigged character (see models.js). The procedural
  // joints stay as an invisible driver: they're re-measured to match the model's proportions so
  // IK, bat grips and hand positions land on the model's own hands and feet.
  // Use a model template (models.js), or null for the code-built body. Swappable at any time.
  setModel(tpl) {
    if ((this.model?.tpl || null) === (tpl || null)) return;
    this.detachModel();
    if (tpl) this.attachModel(tpl);
  }

  detachModel() {
    if (!this.model) return;
    const { root, snapshot } = this.model;
    this.root.remove(root);
    root.traverse((o) => {
      if (o.isMesh) [].concat(o.material).forEach((m) => m.dispose());
    });
    if (this.decal) {
      this.chest.remove(this.decal);
      this.decal.geometry.dispose();
      this.decal.material.map?.dispose();
      this.decal.material.dispose();
      this.decal = null;
    }
    snapshot.forEach(([g, p]) => g.position.copy(p));
    this.len = { ...snapshot.len };
    this.tilt.traverse((o) => {
      if (o.isMesh && o !== this.armR.finger) o.visible = true;
    });
    this.body.visible = true;
    this.headLook.visible = true;
    this.model = null;
    this.kitKey = "";
    if (this.lastKit) this.setKit(this.lastKit);
  }

  attachModel(tpl) {
    if (!tpl || this.model) return;
    // remember the code rig's proportions, to put them back on detach
    const joints = [this.spine, this.chest, this.neck, this.head, this.armL.sh, this.armL.el, this.armL.hand, this.armR.sh, this.armR.el, this.armR.hand, this.legL.th, this.legL.kn, this.legL.an, this.legR.th, this.legR.kn, this.legR.an];
    const snapshot = joints.map((g) => [g, g.position.clone()]);
    snapshot.len = { ...this.len };
    const inst = cloneSkinned(tpl.wrapper);
    const bones = findBones(inst);
    if (!bones.chest) bones.chest = bones.spine;
    const kitMats = { shirt: [], trousers: [] };
    inst.traverse((o) => {
      if (!o.isMesh) return;
      const own = [].concat(o.material).map((m) => {
        const c = m.clone();
        const key = m.name || m.uuid;
        if (tpl.kitMaterials.shirt.has(key)) kitMats.shirt.push(c);
        if (tpl.kitMaterials.trousers.has(key)) kitMats.trousers.push(c);
        return c;
      });
      o.material = Array.isArray(o.material) ? own : own[0];
    });
    const R = tpl.rest;
    const d = (a, b) => R[a].pos.clone().sub(R[b].pos);
    this.spine.position.copy(d("spine", "pelvis"));
    this.chest.position.copy(d("chest", "spine"));
    this.neck.position.copy(R.neck ? d("neck", "chest") : new THREE.Vector3(0, 0.2, 0));
    this.head.position.copy(R.neck ? d("head", "neck") : d("head", "chest").sub(this.neck.position));
    for (const s of ["L", "R"]) {
      const arm = this["arm" + s];
      const leg = this["leg" + s];
      arm.sh.position.copy(d("sh" + s, "chest"));
      arm.el.position.copy(d("el" + s, "sh" + s));
      arm.hand.position.copy(d("ha" + s, "el" + s));
      leg.th.position.copy(d("th" + s, "pelvis"));
      leg.kn.position.copy(d("kn" + s, "th" + s));
      leg.an.position.copy(d("an" + s, "kn" + s));
    }
    this.len = {
      upper: this.armL.el.position.length(),
      fore: this.armL.hand.position.length() + tpl.palm,
      thigh: this.legL.kn.position.length(),
      shin: this.legL.an.position.length(),
      foot: (R.anL.pos.y + R.anR.pos.y) / 2,
      palm: tpl.palm,
      lift: -this.legL.th.position.y,
    };
    this.tilt.traverse((o) => {
      if (o.isMesh && !o.userData.gear) o.visible = false;
    });
    // the procedural gloves are sized for the code-built hands; fielders' bare hands come from the model
    this.model = { root: inst, bones, rest: R, kitMats, tpl, snapshot };
    // name + number on the model's back
    if (tpl.back) {
      const mat = new THREE.MeshStandardMaterial({ transparent: true, alphaTest: 0.4, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -4 });
      this.decal = new THREE.Mesh(new THREE.PlaneGeometry(tpl.back.w, tpl.back.w), mat);
      this.decal.position.set(tpl.back.x - R.chest.pos.x, tpl.back.y - R.chest.pos.y, tpl.back.z - R.chest.pos.z);
      this.decal.rotation.set(tpl.back.tilt, Math.PI, 0);
      this.decal.visible = false;
      this.chest.add(this.decal);
    }
    this.root.add(inst);
    this.kitKey = "";
    if (this.lastKit) this.setKit(this.lastKit);
  }

  _drive() {
    const { bones, rest } = this.model;
    const map = {
      pelvis: this.pelvis, spine: this.spine, chest: this.chest, neck: this.neck, head: this.head,
      shL: this.armL.sh, elL: this.armL.el, haL: this.armL.hand, shR: this.armR.sh, elR: this.armR.el, haR: this.armR.hand,
      thL: this.legL.th, knL: this.legL.kn, anL: this.legL.an, thR: this.legR.th, knR: this.legR.kn, anR: this.legR.an,
    };
    const q = new THREE.Quaternion();
    const pq = new THREE.Quaternion();
    const hips = bones.pelvis;
    hips.parent.updateWorldMatrix(true, false);
    hips.position.copy(hips.parent.worldToLocal(this.pelvis.getWorldPosition(new THREE.Vector3())));
    for (const k of DRIVE_ORDER) {
      const b = bones[k];
      if (!b || !map[k] || !rest[k]) continue;
      map[k].getWorldQuaternion(q).multiply(rest[k].q);
      b.parent.getWorldQuaternion(pq);
      b.quaternion.copy(pq.invert().multiply(q));
      b.updateMatrixWorld(true);
    }
  }

  setKit({ shirt = "#ff7a2e", trousers = "#1e293b", trim, number = "", name = "", code = "", team = "" }) {
    const trimC = trim || new THREE.Color(shirt).offsetHSL(0, 0, -0.25).getStyle();
    const key = [shirt, trousers, trimC, number, name, code, team].join("|");
    if (key === this.kitKey) return;
    this.kitKey = key;
    this.lastKit = { shirt, trousers, trim, number, name, code, team };
    const ump = this.role === "umpire";
    this.m.trim.color.set(trimC);
    this.m.badge.map?.dispose();
    this.m.badge.map = code && !ump ? badgeCanvas(code, trimC) : null;
    this.m.badge.visible = !!this.m.badge.map;
    this.m.badge.needsUpdate = true;
    if (this.decal) {
      this.decal.material.map?.dispose();
      this.decal.material.map = ump ? null : backDecal({ name, number, ink: contrast(shirt, trimC), edge: edgeOf(shirt) });
      this.decal.visible = !ump && !!(name || number !== "");
      this.decal.material.needsUpdate = true;
    }
    if (this.model) {
      for (const m of this.model.kitMats.shirt) (m.map = null), m.color.set(shirt), (m.needsUpdate = true);
      for (const m of this.model.kitMats.trousers) (m.map = null), m.color.set(trousers), (m.needsUpdate = true);
    }
    this.m.shirt.map?.dispose();
    this.m.shirt.map = shirtCanvas(ump ? { shirt, trim: trimC } : { shirt, trim: trimC, number, name, code, team });
    this.m.shirt.needsUpdate = true;
    this.m.sleeve.color.set(shirt);
    this.m.trousers.color.set(trousers);
    this.m.cap.color.set(shirt);
    this.m.helmet.color.set(this.role === "keeper" || this.role === "batter" ? new THREE.Color(trimC).offsetHSL(0, 0, -0.1) : trimC);
    this.kitColors = { shirt, trim: trimC };
    this.applyGearColors();
  }

  // IK: put this side's hand at a world-space point, elbow towards `pole` (chest space).
  _reach(side, target, pole) {
    const a = side === "L" ? this.armL : this.armR;
    const T = this.chest.worldToLocal(target.clone()).sub(a.sh.position);
    const l1 = this.len.upper;
    const l2 = this.len.fore;
    const d0 = T.length() || 1e-4;
    const dn = T.clone().divideScalar(d0);
    const d = clamp(d0, 0.08, l1 + l2 - 0.002);
    const ang = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const P = new THREE.Vector3(...pole).normalize();
    const Pp = P.sub(dn.clone().multiplyScalar(P.dot(dn)));
    if (Pp.lengthSq() < 1e-6) Pp.set(0, 0, 1);
    Pp.normalize();
    const U = dn.clone().multiplyScalar(Math.cos(ang)).add(Pp.multiplyScalar(Math.sin(ang)));
    const F = dn.clone().multiplyScalar(d).sub(U.clone().multiplyScalar(l1)).normalize();
    a.sh.quaternion.setFromUnitVectors(DOWN, U);
    a.el.quaternion.setFromUnitVectors(DOWN, F.applyQuaternion(a.sh.quaternion.clone().invert()));
  }

  // p: { x, z, face, pose, run, time, jump, fall, back, look, reachL, reachR, bat, add, keepArms, visible }
  pose(p) {
    const root = this.root;
    root.visible = p.visible !== false;
    if (!root.visible) return;
    root.position.set(p.x || 0, 0, p.z || 0);
    if (this.armR.finger) this.armR.finger.visible = !!p.finger && !this.model;
    root.rotation.set(0, p.face || 0, 0);
    const fall = p.fall || 0;
    const back = p.back || 0;
    this.tilt.rotation.set(-back, 0, fall);
    this.tilt.position.y = 0.16 * Math.max(Math.abs(Math.sin(fall)), Math.abs(Math.sin(back)));

    const J = blendPoses(p.pose || "stand");
    // procedural gait
    const run = p.run || 0;
    if (run > 0) {
      const sprint = run > 0.6;
      const ph = (p.time || 0) * (sprint ? 11 : 7);
      const A = sprint ? 1 : 0.55;
      const b = Math.min(1, run * 1.6);
      const legCycle = (phase) => [[-0.85 * A * Math.sin(phase), 0, 0], [0.15 + 1.25 * A * Math.max(0, Math.cos(phase))]];
      const [tL, kL] = legCycle(ph);
      const [tR, kR] = legCycle(ph + Math.PI);
      const mixJ = (j, v) => (J[j] = J[j].map((x, i) => angleLerp(x, v[i] ?? 0, b)));
      mixJ("thL", tL);
      mixJ("knL", kL);
      mixJ("thR", tR);
      mixJ("knR", kR);
      if (!p.keepArms) {
        mixJ("shL", [0.75 * A * Math.sin(ph), 0, 0.1]);
        mixJ("shR", [-0.75 * A * Math.sin(ph), 0, -0.1]);
        mixJ("elL", [-(0.5 + 0.9 * A)]);
        mixJ("elR", [-(0.5 + 0.9 * A)]);
      }
      J.chest[0] += 0.16 * A * b;
    }
    if (p.add) for (const [j, v] of Object.entries(p.add)) J[j] = J[j].map((x, i) => x + (v[i] || 0));

    // apply joints
    const set = (o, v) => o.rotation.set(v[0], v[1], v[2]);
    set(this.pelvis, J.pelvis);
    set(this.spine, J.spine);
    set(this.chest, J.chest);
    set(this.neck, J.neck);
    set(this.head, J.head);
    set(this.armL.sh, J.shL);
    set(this.armL.el, J.elL);
    set(this.armR.sh, J.shR);
    set(this.armR.el, J.elR);
    set(this.legL.th, J.thL);
    set(this.legL.kn, J.knL);
    set(this.legR.th, J.thR);
    set(this.legR.kn, J.knR);
    // feet flat on the ground; pelvis height from the straighter leg
    const L = this.len;
    const legH = (th, kn) => (L.thigh * Math.cos(th[0]) + L.shin * Math.cos(th[0] + kn[0])) * Math.cos(th[2]) + L.foot;
    this.legL.an.rotation.set(-(J.thL[0] + J.knL[0]), 0, -J.thL[2]);
    this.legR.an.rotation.set(-(J.thR[0] + J.knR[0]), 0, -J.thR[2]);
    this.pelvis.position.y = Math.max(legH(J.thL, J.knL), legH(J.thR, J.knR)) + L.lift + (p.jump || 0);
    root.updateMatrixWorld(true);

    // head looks at a world point
    if (p.look) {
      const l = this.chest.worldToLocal(p.look.clone()).sub(this.neck.position);
      const yaw = clamp(Math.atan2(l.x, l.z), -1.45, 1.45);
      const pitch = clamp(-Math.atan2(l.y - 0.2, Math.hypot(l.x, l.z)), -0.8, 0.8);
      this.neck.rotation.y = yaw * 0.4;
      this.head.rotation.set(pitch * 0.85 + J.head[0] * 0.2, yaw * 0.6, 0);
    }

    // bat in both hands (IK) / in one hand / hidden
    if (this.bat) {
      const b = p.bat;
      this.bat.visible = b !== null && p.showBat !== false;
      if (b && b.H) {
        const H = new THREE.Vector3(...b.H);
        const D = new THREE.Vector3(...b.D).normalize();
        const F = new THREE.Vector3(...(b.F || [1, 0, 0]));
        const y = D.clone().negate();
        const z = F.sub(y.clone().multiplyScalar(F.dot(y))).normalize();
        const x = new THREE.Vector3().crossVectors(y, z);
        this.bat.position.copy(H);
        this.bat.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
        this._reach("L", root.localToWorld(H.clone().addScaledVector(D, 0.04)), b.poleL || [0.6, -1, 0.2]);
        this._reach("R", root.localToWorld(H.clone().addScaledVector(D, 0.16)), b.poleR || [-0.4, -1, -0.1]);
      }
    }
    if (p.reachL) this._reach("L", p.reachL, p.poleL || [0.5, -0.8, -0.4]);
    if (p.reachR) this._reach("R", p.reachR, p.poleR || [-0.5, -0.8, -0.4]);
    if (this.bat && this.bat.visible && (!p.bat || !p.bat.H)) {
      // carried in the right hand
      root.updateMatrixWorld(true);
      const hp = this.handPos("R");
      const hq = this.armR.hand.getWorldQuaternion(new THREE.Quaternion());
      const rq = root.getWorldQuaternion(new THREE.Quaternion()).invert();
      this.bat.quaternion.copy(rq.multiply(hq)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(p.batTilt ?? 0.35, 0, 0)));
      // the hand grips ~10 cm below the top of the handle
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.bat.quaternion);
      this.bat.position.copy(root.worldToLocal(hp)).addScaledVector(up, 0.1);
    }
    if (this.model) this._drive();
  }

  handPos(side = "R") {
    return (side === "L" ? this.armL : this.armR).hand.localToWorld(new THREE.Vector3(0, -this.len.palm, 0));
  }
}
