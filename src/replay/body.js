// One continuous, skinned body for the code-built cricketers: trunk, neck, arms and legs are
// tubes of elliptical rings, each ring weighted to one or two joints of the rig, so elbows, knees,
// hips and shoulders bend smoothly instead of showing ball joints. The shirt (with the kit texture),
// sleeves, cuff trim, bare arms and trousers are material groups of the same mesh.
//
// Rings are built in the rig's rest pose (every joint unrotated, arms hanging, legs straight), in
// the coordinates of the player's `tilt` group. The trunk's u = 0 is the middle of the chest and
// u = 0.5 the back, which is how the shirt texture is laid out.
import * as THREE from "three";

export const BONE_ORDER = ["pelvis", "spine", "chest", "neck", "head", "shL", "elL", "haL", "shR", "elR", "haR", "thL", "knL", "anL", "thR", "knR", "anR"];
const BI = Object.fromEntries(BONE_ORDER.map((k, i) => [k, i]));
export const BODY_MATS = ["shirt", "sleeve", "trim", "skin", "trousers"];
const M = Object.fromEntries(BODY_MATS.map((k, i) => [k, i]));

const BUILD = {
  slim: { w: 0.92, d: 0.9, belly: 0, arm: 1.0, leg: 0.94 },
  athletic: { w: 1, d: 1, belly: 0, arm: 1.13, leg: 1.03 },
  strong: { w: 1.08, d: 1.06, belly: 0.006, arm: 1.3, leg: 1.1 },
  heavy: { w: 1.1, d: 1.2, belly: 0.045, arm: 1.22, leg: 1.12 },
};

const N = 24; // segments around each ring

// rest: { joint: Vector3 } in tilt space; look: see look.js; role: batter | keeper | fielder | umpire
export function bodyGeometry(rest, look, role) {
  const B = BUILD[look?.build] || BUILD.athletic;
  const pos = [];
  const uv = [];
  const skI = [];
  const skW = [];
  const idx = BODY_MATS.map(() => []);
  const seams = []; // [first, last] vertex of each ring, to smooth normals across the uv seam

  const weights = (w) => {
    const list = (typeof w === "string" ? [[w, 1]] : w).filter(([, x]) => x > 0).slice(0, 4);
    const sum = list.reduce((s, [, x]) => s + x, 0) || 1;
    const i = [0, 0, 0, 0];
    const v = [0, 0, 0, 0];
    list.forEach(([b, x], k) => {
      i[k] = BI[b];
      v[k] = x / sum;
    });
    return [i, v];
  };
  const vert = (x, y, z, u, v, w) => {
    pos.push(x, y, z);
    uv.push(u, v);
    const [i, ww] = weights(w);
    skI.push(...i);
    skW.push(...ww);
    return pos.length / 3 - 1;
  };
  // rings: bottom → top; each { c: [x, y, z], rx, rz, w, m (material of the band above), v }
  const tube = (rings, { capBottom = true, capTop = true } = {}) => {
    const start = pos.length / 3;
    for (const r of rings) {
      const first = pos.length / 3;
      for (let k = 0; k <= N; k++) {
        const a = (k / N) * Math.PI * 2;
        vert(r.c[0] + Math.sin(a) * r.rx, r.c[1], r.c[2] + Math.cos(a) * r.rz, k / N, r.v ?? 0, r.w);
      }
      seams.push([first, first + N]);
    }
    for (let i = 0; i < rings.length - 1; i++) {
      const out = idx[rings[i].m ?? M.skin];
      for (let k = 0; k < N; k++) {
        const a = start + i * (N + 1) + k;
        const b = a + 1;
        const c = a + N + 1;
        const d = c + 1;
        out.push(a, b, c, b, d, c);
      }
    }
    const cap = (ri, up) => {
      const r = rings[ri];
      const ctr = vert(r.c[0], r.c[1] + (up ? 0.012 : -0.012), r.c[2], 0.5, r.v ?? 0, r.w);
      const base = start + ri * (N + 1);
      const out = idx[r.m ?? M.skin];
      for (let k = 0; k < N; k++) up ? out.push(ctr, base + k, base + k + 1) : out.push(ctr, base + k + 1, base + k);
    };
    if (capBottom) cap(0, false);
    if (capTop) cap(rings.length - 1, true);
  };

  const P = rest.pelvis;
  // ---- trunk: hips (trousers) → tucked-in shirt → chest → shoulders → collar ----
  const yS = rest.spine.y;
  const yC = rest.chest.y;
  const trunkW = (y) => {
    if (y <= P.y) return "pelvis";
    if (y <= yS) return [["pelvis", (yS - y) / (yS - P.y)], ["spine", (y - P.y) / (yS - P.y)]];
    if (y <= yC) return [["spine", (yC - y) / (yC - yS)], ["chest", (y - yS) / (yC - yS)]];
    return "chest";
  };
  const shirt0 = 0.07;
  const shirt1 = 0.615;
  const trunk = [
    [-0.15, 0.12, 0.095, "trousers"],
    [-0.09, 0.165, 0.118, "trousers"],
    [0.0, 0.17, 0.116, "trousers"],
    [0.05, 0.158, 0.107, "trousers"],
    [shirt0, 0.157, 0.107, "shirt"],
    [0.15, 0.158 + B.belly, 0.11 + B.belly * 1.4, "shirt"],
    [0.25, 0.172 + B.belly * 0.5, 0.117 + B.belly * 0.7, "shirt"],
    [0.35, 0.186, 0.122, "shirt"],
    [0.45, 0.19, 0.118, "shirt"],
    [0.53, 0.186, 0.103, "shirt"],
    [0.58, 0.16, 0.087, "shirt"],
    [shirt1, 0.074, 0.062, "shirt"],
  ].map(([dy, rx, rz, m]) => ({
    c: [P.x, P.y + dy, P.z + (dy > 0.3 ? 0.006 : 0)],
    rx: rx * B.w,
    rz: rz * B.d,
    w: trunkW(P.y + dy),
    m: M[m],
    v: Math.min(1, Math.max(0, (dy - shirt0) / (shirt1 - shirt0))),
  }));
  tube(trunk);

  // ---- neck ----
  const nk = rest.neck;
  const hd = rest.head;
  tube(
    [
      { c: [nk.x, nk.y - 0.08, nk.z - 0.008], rx: 0.062, rz: 0.058, w: "chest", m: M.skin },
      { c: [nk.x, nk.y, nk.z - 0.008], rx: 0.054 * B.w, rz: 0.052, w: [["neck", 0.7], ["chest", 0.3]], m: M.skin },
      { c: [nk.x, nk.y + 0.045, nk.z - 0.006], rx: 0.05 * B.w, rz: 0.049, w: "neck", m: M.skin },
      { c: [hd.x, hd.y + 0.02, hd.z - 0.004], rx: 0.048, rz: 0.048, w: [["head", 0.6], ["neck", 0.4]], m: M.skin },
      { c: [hd.x, hd.y + 0.06, hd.z], rx: 0.044, rz: 0.044, w: "head", m: M.skin },
    ],
    { capBottom: false }
  );

  // ---- arms: sleeve → cuff trim → biceps → elbow → forearm → wrist ----
  const umpire = role === "umpire";
  const sleeve = umpire ? 0.27 : 0.17;
  for (const s of ["L", "R"]) {
    const sh = rest["sh" + s];
    const el = rest["el" + s];
    const ha = rest["ha" + s];
    const up = el.y - sh.y; // negative
    const A = B.arm;
    const SH = "sh" + s;
    const EL = "el" + s;
    const HA = "ha" + s;
    const rings = [];
    const R = (dy, rx, rz, w, m, inward = 0) => rings.push({ c: [sh.x * (1 - inward), sh.y + dy, sh.z], rx, rz, w, m: M[m] });
    R(0.075, 0.05, 0.048, [["chest", 0.85], [SH, 0.15]], "sleeve", 0.12);
    R(0.035, 0.07 * A, 0.066, [["chest", 0.45], [SH, 0.55]], "sleeve", 0.04);
    R(-0.02, 0.071 * A, 0.066 * A, [[SH, 0.88], ["chest", 0.12]], "sleeve");
    R(-0.09, 0.065 * A, 0.06 * A, SH, "sleeve");
    R(-sleeve + 0.014, 0.062 * A, 0.057 * A, SH, umpire ? "sleeve" : "trim");
    R(-sleeve - 0.004, 0.062 * A, 0.057 * A, SH, "skin");
    // skin from here (umpires' long sleeves cover the biceps)
    const skin = [
      [-sleeve - 0.012, 0.05, 0.047, SH],
      [-0.2, 0.051, 0.048, SH],
      [-0.24, 0.048, 0.045, SH],
      [up + 0.02, 0.043, 0.041, [[SH, 0.7], [EL, 0.3]]],
      [up, 0.041, 0.041, [[SH, 0.5], [EL, 0.5]]],
      [up - 0.02, 0.042, 0.041, [[EL, 0.82], [SH, 0.18]]],
      [up - 0.08, 0.046, 0.041, EL],
      [up - 0.16, 0.04, 0.034, EL],
      [ha.y - sh.y + 0.035, 0.031, 0.025, [[EL, 0.75], [HA, 0.25]]],
      [ha.y - sh.y + 0.004, 0.027, 0.022, HA],
    ];
    for (const [dy, rx, rz, w] of skin) {
      if (dy >= -sleeve - 0.01) continue;
      R(dy, rx * A, rz * A, w, umpire && dy > up + 0.02 ? "sleeve" : "skin");
    }
    tube(rings.reverse().map((r, i, arr) => ({ ...r, m: arr[Math.min(i + 1, arr.length - 1)].m ?? r.m })), { capTop: false });
  }

  // ---- legs: hips → thigh → knee → calf → ankle (in the shoe) ----
  for (const s of ["L", "R"]) {
    const th = rest["th" + s];
    const kn = rest["kn" + s];
    const an = rest["an" + s];
    const TH = "th" + s;
    const KN = "kn" + s;
    const AN = "an" + s;
    const k = kn.y - th.y;
    const a = an.y - th.y;
    const L = B.leg;
    const rings = [
      [0.1, 0.1, 0.1, "pelvis", 0],
      [0.04, 0.102, 0.11, [["pelvis", 0.6], [TH, 0.4]], 0],
      [-0.02, 0.097, 0.104, [[TH, 0.85], ["pelvis", 0.15]], 0],
      [-0.14, 0.087, 0.091, TH, 0.004],
      [-0.28, 0.073, 0.075, TH, 0.006],
      [k + 0.04, 0.061, 0.063, [[TH, 0.7], [KN, 0.3]], 0.008],
      [k, 0.059, 0.061, [[TH, 0.5], [KN, 0.5]], 0.008],
      [k - 0.04, 0.059, 0.061, [[KN, 0.82], [TH, 0.18]], 0.004],
      [k - 0.14, 0.059, 0.066, KN, -0.01],
      [k - 0.27, 0.048, 0.052, KN, -0.004],
      [a + 0.05, 0.041, 0.044, [[KN, 0.7], [AN, 0.3]], 0],
      [a - 0.01, 0.039, 0.042, AN, 0],
    ].map(([dy, rx, rz, w, dz]) => ({ c: [th.x, th.y + dy, th.z + dz], rx: rx * L, rz: rz * L, w, m: M.trousers }));
    tube(rings.reverse());
  }

  const g = new THREE.BufferGeometry();
  const index = [];
  idx.forEach((list, m) => {
    if (list.length) g.addGroup(index.length, list.length, m);
    index.push(...list);
  });
  g.setIndex(index);
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skI, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skW, 4));
  g.computeVertexNormals();
  // the first and last vertex of a ring are the same point: share their normal
  const n = g.attributes.normal;
  for (const [a, b] of seams) {
    const x = (n.getX(a) + n.getX(b)) / 2;
    const y = (n.getY(a) + n.getY(b)) / 2;
    const z = (n.getZ(a) + n.getZ(b)) / 2;
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l);
    n.setXYZ(b, x / l, y / l, z / l);
  }
  return g;
}
