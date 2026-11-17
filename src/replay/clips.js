// Turns a highlight moment into an animated 3D clip. Every clip is a pure function of time:
// update(t) → { st (where everyone is, poses, ball…), cam, excite, screen, replay }, so clips can
// be restarted, scrubbed, slowed down, replayed from another camera and chained together.
import { BOUNDARY, FIELD, arc, flight, lerp, mix, seg, smooth, v3 } from "./world.js";

const PI = Math.PI;
const RELEASE = 1.9; // ball leaves the bowler's hand
const BOUNCE = 2.2;
const C = 2.42; // ball reaches the batter
export const CONTACT = C;
const S0 = v3(0, 0, -9.1);
const SC = v3(-0.02, 0.36, -8.6); // contact point
const STRIKER = { x: 0.42, z: -9.1 };
const NON = { x: -1.2, z: 10.8 };
const UMP = { x: -0.55, z: 12.4 };
const PAVILION = v3(-36, 0, -42);
const BOWLER_LOOK = v3(0.4, 1.9, 9.6);
const KEEPER_GLOVES = v3(0, 0.7, -13.0);

const hash = (s) => {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
const faceTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const dirFromAngle = (a) => v3(-Math.sin((a * PI) / 180), 0, Math.cos((a * PI) / 180));
const easeOut = (s) => 1 - (1 - s) * (1 - s);
const isVec = (b) => !!b && b.x !== undefined;

function ropeDistance(dir) {
  const b = S0.x * dir.x + S0.z * dir.z;
  const c = S0.x * S0.x + S0.z * S0.z - BOUNDARY * BOUNDARY;
  return -b + Math.sqrt(b * b - c);
}
function fielderFor(dir) {
  let best = 2;
  let bestScore = Infinity;
  FIELD.forEach((f, i) => {
    const v = v3(f.x - S0.x, 0, f.z - S0.z);
    const d = v.length();
    if (d < 6) return;
    const ang = Math.acos(Math.max(-1, Math.min(1, (v.x * dir.x + v.z * dir.z) / d)));
    if (ang < bestScore) (bestScore = ang), (best = i);
  });
  return best;
}

// ---------- keyframes ----------
// list: [[time, pose], ...] → a blend for Player.pose
function keys(t, list) {
  if (t <= list[0][0]) return list[0][1];
  for (let i = 0; i < list.length - 1; i++) {
    if (t < list[i + 1][0]) {
      const w = smooth(seg(t, list[i][0], list[i + 1][0]));
      return [[list[i][1], 1 - w], [list[i + 1][1], w]];
    }
  }
  return list[list.length - 1][1];
}
const lerp3 = (a, b, w) => a.map((x, i) => lerp(x, b[i], w));
function gripAt(t, list) {
  const at = (g) => ({ H: g.H, D: g.D, F: g.F || [1, 0, 0] });
  if (t <= list[0][0]) return at(list[0][1]);
  for (let i = 0; i < list.length - 1; i++) {
    if (t < list[i + 1][0]) {
      const w = smooth(seg(t, list[i][0], list[i + 1][0]));
      const a = at(list[i][1]);
      const b = at(list[i + 1][1]);
      return { H: lerp3(a.H, b.H, w), D: lerp3(a.D, b.D, w), F: lerp3(a.F, b.F, w) };
    }
  }
  return at(list[list.length - 1][1]);
}

// Bat positions in the batter's own space (faces the off side; the bowler is at +x).
const G = {
  stance: { H: [0.08, 0.98, 0.32], D: [-0.22, -1, 0.12] },
  back: { H: [-0.12, 1.38, 0.2], D: [-0.75, 0.62, -0.05], F: [0.3, 0.5, 0.8] },
  drive: { H: [0.32, 0.92, 0.38], D: [0.32, -1, 0.12] },
  driveF: { H: [0.18, 1.55, 0.12], D: [-0.55, 0.7, -0.45], F: [0, 0, 1] },
  loftF: { H: [0.05, 1.72, 0.05], D: [-0.6, 0.75, -0.3], F: [0, 0, 1] },
  pull: { H: [0.25, 1.18, 0.32], D: [0.35, -0.35, 0.85] },
  pullF: { H: [-0.1, 1.4, -0.05], D: [-0.55, 0.35, -0.75], F: [0, 0, 1] },
  defend: { H: [0.38, 0.95, 0.38], D: [0.12, -1, 0.06] },
  leave: { H: [-0.05, 1.65, 0.08], D: [-0.35, 0.92, -0.15], F: [0, 0, 1] },
};
const SWING = {
  drive: { body: ["batDrive", "batFollow"], grip: ["drive", "driveF"] },
  loft: { body: ["batDrive", "batLoft"], grip: ["drive", "loftF"] },
  pull: { body: ["batBack", "batPullFollow"], grip: ["pull", "pullF"] },
  defend: { body: ["batDefend", "batDefend"], grip: ["defend", "defend"] },
  leave: { body: ["batLeave", "batLeave"], grip: ["leave", "leave"] },
};
function batter(t, style = "drive", late = 0) {
  const s = SWING[style] || SWING.drive;
  const up = style === "leave" ? "batLeave" : "batBackLift";
  const pose = keys(t, [[0, "batStance"], [1.8 + late, "batStance"], [2.2 + late, up], [C + late, s.body[0]], [C + 0.42 + late, s.body[1]]]);
  const bat = gripAt(t, [[0, G.stance], [1.8 + late, G.stance], [2.2 + late, style === "leave" ? G.leave : G.back], [C + late, G[s.grip[0]]], [C + 0.42 + late, G[s.grip[1]]]]);
  return { ...STRIKER, face: -PI / 2, pose, bat };
}

function bowlerAt(t, { noBall = false } = {}) {
  const r0 = RELEASE - 0.55;
  const relZ = noBall ? 8.5 : 9.6;
  let x;
  let z;
  if (t < r0) {
    const s = seg(t, 0, r0);
    x = lerp(1.9, 0.55, s);
    z = lerp(24, 11.6, s * s * 0.35 + s * 0.65);
  } else if (t < RELEASE) {
    const s = seg(t, r0, RELEASE);
    x = lerp(0.55, 0.35, s);
    z = lerp(11.6, relZ, s);
  } else {
    const s = easeOut(seg(t, RELEASE, RELEASE + 1.0));
    x = lerp(0.35, 1.8, s);
    z = lerp(relZ, relZ - 3, s);
  }
  const pose = keys(t, [[0, "stand"], [r0 - 0.01, "stand"], [RELEASE - 0.42, "bowlBound"], [RELEASE - 0.18, "bowlCoil"], [RELEASE, "bowlRelease"], [RELEASE + 0.32, "bowlFollow"], [RELEASE + 0.95, "stand"]]);
  const run = t < r0 ? 1 : t < RELEASE + 0.3 ? 0 : 0.7 * (1 - seg(t, RELEASE + 0.3, RELEASE + 1.0));
  return { x, z, face: PI, pose, run, jump: 0.3 * Math.sin(seg(t, RELEASE - 0.5, RELEASE - 0.2) * PI), time: t, look: v3(0, 1.2, -9) };
}

function deliveryBall(t, line = {}, noBall = false) {
  if (t < RELEASE) return "hand";
  const R = v3(0.55, 2.2, noBall ? 8.4 : 9.45);
  const B = v3(line.bx ?? 0.05, 0.04, line.bz ?? -3.6);
  const Cp = v3(line.cx ?? SC.x, line.cy ?? SC.y, line.cz ?? SC.z);
  if (t < BOUNCE) return arc(R, B, 0.12, seg(t, RELEASE, BOUNCE));
  if (t < C) return arc(B, Cp, 0.18, seg(t, BOUNCE, C));
  return mix(Cp, KEEPER_GLOVES, seg(t, C, C + 0.35));
}

function base(t, ctx = {}) {
  return {
    striker: batter(t, ctx.swing || "drive", ctx.late || 0),
    nonStriker: { x: NON.x, z: lerp(NON.z, 9.3, smooth(seg(t, 1.2, 2.3))), face: PI, run: seg(t, 1.2, 1.4) * (1 - seg(t, 2.1, 2.3)) * 0.4, time: t + 3, pose: "stand" },
    bowler: bowlerAt(t, ctx),
    umpire: { ...UMP, face: PI, pose: "umpire" },
    fielders: FIELD.map((f, i) => {
      if (f.id === "keeper") return { x: f.x, z: f.z, face: 0, pose: t < C - 0.1 ? "keeper" : [["keeper", 1 - seg(t, C - 0.1, C + 0.3)], ["keeperUp", seg(t, C - 0.1, C + 0.3)]] };
      if (f.id === "slip") return { x: f.x, z: f.z, face: 0.1, pose: "slip" };
      const home = v3(f.x, 0, f.z);
      const walk = smooth(seg(t, 1.0, 2.3)) * 1.8;
      const toS = v3(S0.x - home.x, 0, S0.z - home.z).normalize();
      return { x: home.x + toS.x * walk, z: home.z + toS.z * walk, run: seg(t, 1.0, 1.2) * (1 - seg(t, 2.1, 2.3)) * 0.4, time: t + i, pose: [["stand", 1 - seg(t, 1.6, 2.3)], ["ready", seg(t, 1.6, 2.3)]] };
    }),
    ball: t < 4 ? deliveryBall(t, ctx.line, ctx.noBall) : null,
    stumpsBat: -1,
    stumpsBowl: -1,
    stumpsWild: 1,
    duck: null,
    confetti: -1,
    confettiAt: [0, 0],
  };
}

// ---------- helpers for actions ----------
const fpos = (st, i) => v3(st.fielders[i].x, 0, st.fielders[i].z);
const runTo = (from, to, s) => ({ x: lerp(from.x, to.x, s), z: lerp(from.z, to.z, s), face: s < 1 ? faceTo(from, to) : undefined, run: s > 0 && s < 1 ? 1 : 0 });
const celebrate = (t, i = 0, k = 1) => ({ pose: "celebrate", jump: Math.abs(Math.sin(t * 6 + i)) * 0.42 * k, run: 0 });
const clapAdd = (t) => ({ shL: [0, 0, Math.sin(t * 16) * 0.25], shR: [0, 0, -Math.sin(t * 16) * 0.25] });
function walkOff(t, t0, st, who = "striker") {
  const s = seg(t, t0, t0 + 16);
  const from = v3(st[who].x, 0, st[who].z);
  const p = mix(from, PAVILION, s);
  st[who] = { x: p.x, z: p.z, face: faceTo(from, PAVILION), run: s > 0 ? 0.35 : 0, pose: "dejected", time: t * 0.6, batTilt: 1.2, look: null };
  return p;
}
function mob(t, st, t0, at, except = -1) {
  st.fielders.forEach((f, i) => {
    if (i === except) return;
    const home = v3(f.x, 0, f.z);
    const ang = (i / FIELD.length) * PI * 2;
    const target = v3(at.x + Math.sin(ang) * 1.6, 0, at.z + Math.cos(ang) * 1.6);
    const s = seg(t, t0, t0 + dist2(home, target) / 7.5);
    Object.assign(f, runTo(home, target, s), { time: t + i });
    if (s >= 1) Object.assign(f, celebrate(t, i, 0.7), { face: faceTo(target, at) }, i % 3 ? {} : { pose: "clap", add: clapAdd(t) });
  });
}
// hands meet the ball (IK), a little either side of it
const reachBall = (b, side = 0.07) => (isVec(b) ? { reachL: v3(b.x + side, b.y, b.z), reachR: v3(b.x - side, b.y, b.z) } : {});

// ---------- cameras ----------
const CAM = {
  broadcast: () => ({ id: "bc", pos: v3(0.5, 4.6, 29), look: v3(0, 1.0, -6.5), fov: 24 }),
  follow: (dir, ball) => {
    const b = isVec(ball) ? ball : v3(S0.x + dir.x * 30, 2, S0.z + dir.z * 30);
    return { id: "follow", pos: v3(S0.x - dir.x * 20, 12 + b.y * 0.5, S0.z - dir.z * 20), look: v3(b.x, b.y * 0.6, b.z), fov: 46, ease: 5 };
  },
  side: (z = -9.8) => ({ id: `side${z}`, pos: v3(8.5, 1.4, z + 0.8), look: v3(0, 0.6, z), fov: 28 }),
  batter: () => ({ id: "batcam", pos: v3(-7.5, 1.7, -6.2), look: v3(0, 1.0, -9.0), fov: 30 }),
  stump: () => ({ id: "stumpcam", pos: v3(0.05, 0.35, -11.4), look: v3(0, 0.6, 0), fov: 38 }),
  foot: () => ({ id: "footcam", pos: v3(2.8, 0.45, 8.3), look: v3(0.3, 0.2, 8.7), fov: 28 }),
  orbit: (c, t, r = 8, h = 2.8, id = "orbit") => ({ id, pos: v3(c.x + Math.sin(t * 0.35) * r, h, c.z + Math.cos(t * 0.35) * r), look: v3(c.x, 1.2, c.z), fov: 36, ease: 3 }),
  umpire: () => ({ id: "ump", pos: v3(-3.8, 2.0, 7.0), look: v3(-0.5, 1.6, 12.4), fov: 32 }),
  wide: () => ({ id: "wide", pos: v3(0, 70, -60), look: v3(0, 0, 0), fov: 50, ease: 2 }),
  // tracking close-up of the bowler running in, then the usual broadcast view from behind
  runup: (b) => ({ id: "runup", pos: v3(b.x + 2.4, 1.75, b.z - 6.2), look: v3(b.x, 1.35, b.z), fov: 30, ease: 9 }),
  open: (t, st) => (t < RELEASE - 0.72 && st?.bowler ? CAM.runup(st.bowler) : CAM.broadcast()),
  // overhead spider-cam riding over the ball
  spider: (ball) => {
    const b = isVec(ball) ? ball : v3(0, 0, 0);
    return { id: "spider", pos: v3(b.x * 0.55, 26, b.z * 0.55 + 7), look: v3(b.x, 0, b.z), fov: 52, ease: 3.5 };
  },
  // a shot of the stands going wild
  crowd: (t, a = Math.PI - 0.7) => ({ id: "crowd", pos: v3(Math.sin(a) * 52, 2.2, Math.cos(a) * 52), look: v3(Math.sin(a + 0.12 * Math.sin(t * 0.6)) * 90, 10, Math.cos(a + 0.12 * Math.sin(t * 0.6)) * 90), fov: 34, ease: 2 }),
  // Hawk-Eye: high behind the bowler, looking down the pitch
  hawk: (t) => ({ id: "hawk", pos: v3(lerp(3.5, 0.6, smooth(seg(t, 0, 2.5))), lerp(4.5, 2.6, smooth(seg(t, 0, 2.5))), lerp(16, 6, smooth(seg(t, 0, 2.5)))), look: v3(0, 0.35, -8.6), fov: lerp(26, 18, smooth(seg(t, 0, 2.5))), ease: 30 }),
  // TV close-up in front of a player (face-on, chest up), crowd behind
  hero: (p, dist = 2.6, side = 0.35) => {
    const f = p.face ?? 0;
    const fx = Math.sin(f + side);
    const fz = Math.cos(f + side);
    return { id: "hero", pos: v3(p.x + fx * dist, 1.55, p.z + fz * dist), look: v3(p.x, 1.42, p.z), fov: 30, ease: 4 };
  },
  close: (p, side = 1) => ({ id: "close", pos: v3(p.x + 5 * side, 2, p.z + 4), look: v3(p.x, 1.4, p.z), fov: 30, ease: 4 }),
};

// ---------- clip combinators ----------
// After the live action, show a slow-motion replay of [from, to] from another camera.
function withReplay(clip, { from, to, rate = 0.38, cam, label }) {
  const live = clip.duration;
  return {
    ...clip,
    duration: live + (to - from) / rate + 0.4,
    update(t) {
      if (t <= live) return clip.update(t);
      const tt = Math.min(to, from + (t - live) * rate);
      const f = clip.update(tt);
      return { ...f, cam: cam(tt, f.st), replay: label || true, excite: 0.2 };
    },
  };
}
// Crowd cutaway after the live action: the stands celebrate.
function withCrowd(clip, dur = 1.8) {
  const live = clip.duration;
  return {
    ...clip,
    duration: live + dur,
    update(t) {
      if (t <= live) return clip.update(t);
      const f = clip.update(live);
      return { ...f, st: { ...f.st, ball: null }, cam: CAM.crowd(t - live), excite: 1 };
    },
  };
}
// Hawk-Eye ball tracking for an LBW: the path, where it pitched, the impact, and the stumps it
// would have hit. `hawk` in the frame is drawn by world.setHawkEye().
function withHawkEye(clip, { freezeAt, path, pitch, impact, stumps, dur = 5 }) {
  const live = clip.duration;
  return {
    ...clip,
    duration: live + dur,
    bursts: [
      ...(clip.bursts || []),
      { t: live + 0.9, text: "PITCHING · IN LINE", tone: "x" },
      { t: live + 2.0, text: "IMPACT · IN LINE", tone: "x" },
      { t: live + 3.2, text: "WICKETS · HITTING", tone: "w" },
    ],
    update(t) {
      if (t <= live) return clip.update(t);
      const lt = t - live;
      const f = clip.update(freezeAt);
      return {
        ...f,
        st: { ...f.st, ball: null },
        cam: CAM.hawk(lt),
        excite: 0.3,
        replay: "hawk",
        hawk: { key: "lbw", path, pitch, impact, stumps, progress: smooth(seg(lt, 0.3, 3.3)), shown: lt },
        screen: { big: "HAWK-EYE", small: lt > 3.2 ? "Wickets: HITTING" : lt > 2 ? "Impact: in line" : "Pitching: in line", color: "#7cc4ff" },
      };
    },
  };
}

// Umpire's decision: after the live action, cut to the umpire and zoom in as the signal is given.
const SIGNAL = {
  out: { pose: "umpOut", text: "OUT!", tone: "w" },
  six: { pose: "umpSix", text: "SIX!", tone: "six" },
  four: { pose: "umpFour", text: "FOUR!", tone: "four" },
  wide: { pose: "umpWide", text: "WIDE!", tone: "x" },
  noball: { pose: "umpNoBall", text: "NO BALL!", tone: "x" },
};
function withDecision(clip, signal, { at } = {}) {
  const live = clip.duration;
  const D = 3.1;
  const sig = SIGNAL[signal];
  return {
    ...clip,
    duration: live + D,
    bursts: [...(clip.bursts || []), { t: live + 1.0, text: `UMPIRE · ${sig.text}`, tone: sig.tone }],
    update(t) {
      if (t <= live) return clip.update(t);
      const lt = t - live;
      const f = clip.update(at ?? live);
      const raise = smooth(seg(lt, 0.55, 1.05));
      let add;
      if (signal === "four") add = { shR: [0, 0, Math.sin(lt * 7) * 0.7 * raise] };
      if (signal === "six") add = { shL: [0, 0, Math.sin(lt * 4) * 0.06 * raise], shR: [0, 0, -Math.sin(lt * 4) * 0.06 * raise] };
      const st = {
        ...f.st,
        ball: null,
        // keep the non-striker out of the shot
        nonStriker: { x: -2.6, z: 10.4, face: PI, pose: "stand", time: t, bat: undefined },
        umpire: { ...UMP, face: PI + 0.25, pose: [["umpire", 1 - raise], [sig.pose, raise]], add, finger: signal === "out" && raise > 0.4, look: v3(UMP.x + 2.4, 1.6, UMP.z - 6) },
      };
      // slow push-in from a mid shot to a tight shot of the umpire
      const z = smooth(seg(lt, 0, 1.5));
      const cam = { id: "decision", pos: v3(UMP.x + 2.3, 1.62, UMP.z - 2.7), look: v3(UMP.x, lerp(1.3, signal === "six" || signal === "out" ? 1.75 : 1.5, z), UMP.z), fov: lerp(34, signal === "six" || signal === "out" ? 19 : 15, z), ease: 30 };
      return { ...f, st, cam, excite: 0.7, decision: true };
    },
  };
}

// Play clips one after another.
function sequence(clips) {
  const starts = [];
  let total = 0;
  for (const c of clips) {
    starts.push(total);
    total += c.duration;
  }
  return {
    duration: total,
    winners: clips.some((c) => c.winners),
    bursts: clips.flatMap((c, i) => (c.bursts || []).map((b) => ({ ...b, t: b.t + starts[i] }))),
    slow: clips.flatMap((c, i) => (c.slow || []).map(([a, b, r]) => [a + starts[i], b + starts[i], r])),
    update(t) {
      let i = clips.length - 1;
      while (i > 0 && t < starts[i]) i--;
      const f = clips[i].update(t - starts[i]);
      return { ...f, cam: { ...f.cam, id: `${i}:${f.cam.id}` } };
    },
  };
}

// ---------- clip scripts ----------
function shotDir(m, prefer) {
  const shot = m.play?.shot;
  if (shot && typeof shot.a === "number") return dirFromAngle(shot.left ? 360 - shot.a : shot.a);
  const r = hash(m.id || m.title);
  const ranges = prefer === "six" ? [[300, 360], [0, 30], [240, 300]] : prefer === "air" ? [[20, 70], [290, 340], [240, 290]] : [[20, 160], [200, 340]];
  const [a, b] = ranges[Math.floor(r * ranges.length) % ranges.length];
  return dirFromAngle(a + ((r * 997) % 1) * (b - a));
}
const styleFor = (dir, lofted) => (dir.x > 0.35 ? "pull" : lofted ? "loft" : "drive");
const nameOf = (m, k) => m.play?.[k] || "";

function sixClip(m, { noBall = false, freeHit = false } = {}) {
  const dir = shotDir(m, "six");
  const style = styleFor(dir, true);
  const L = ropeDistance(dir);
  const land = v3(S0.x + dir.x * (L + 15), 4, S0.z + dir.z * (L + 15));
  const fi = fielderFor(dir);
  const T_LAND = C + 2.9;
  const clip = {
    duration: 7.4,
    bursts: [...(noBall ? [{ t: RELEASE + 0.5, text: "NO BALL!", tone: "x" }] : []), { t: C + 1.4, text: freeHit ? "FREE HIT · SIX!" : "SIX!", tone: "six" }],
    update(t) {
      const st = base(t, { swing: style, noBall });
      if (t >= C) st.ball = t < T_LAND ? flight(SC, land, 22 + L * 0.15, seg(t, C, T_LAND)) : null;
      st.striker.look = isVec(st.ball) ? st.ball : land;
      if (t > C + 3.4) st.striker = { ...st.striker, pose: "batRaise", bat: undefined, look: null };
      const home = fpos(st, fi);
      const rope = v3(S0.x + dir.x * (L - 1.5), 0, S0.z + dir.z * (L - 1.5));
      const s = seg(t, C + 0.3, C + 0.3 + dist2(home, rope) / 7);
      Object.assign(st.fielders[fi], runTo(home, rope, s), { time: t }, s >= 1 ? { pose: "dejected", face: faceTo(rope, land) } : {});
      if (noBall && t > RELEASE + 0.4 && t < C + 1.8) st.umpire.pose = "umpNoBall";
      if (t > C + 3) st.umpire.pose = "umpSix";
      if (t > C + 3.2) st.nonStriker = { ...st.nonStriker, pose: "clap", add: clapAdd(t) };
      if (t > C + 3.4) st.striker.face = -PI / 2 + 0.6;
      const cam = t < C + 0.12 ? CAM.open(t, st) : t < T_LAND + 0.3 ? CAM.follow(dir, st.ball) : CAM.hero(st.striker, 2.5, 0.2);
      return { st, cam, excite: t > C + 0.5 ? 1 : 0.1, screen: t > C + 1.4 ? { big: "SIX!", small: nameOf(m, "striker") } : null };
    },
  };
  return withReplay(withReplay(withDecision(withCrowd(clip), "six"), { from: C - 0.45, to: C + 0.8, cam: () => CAM.batter() }), { from: C - 0.22, to: C + 0.3, rate: 0.2, cam: () => ({ id: "contact", pos: v3(-3.1, 1.25, -7.3), look: v3(0.15, 0.85, -8.9), fov: 34 }), label: "SUPER SLOW-MO" });
}

function fourClip(m, { freeHit = false } = {}) {
  const dir = shotDir(m, "four");
  const style = styleFor(dir, false);
  const L = ropeDistance(dir);
  const edge = v3(S0.x + dir.x * (L - 0.3), 0.08, S0.z + dir.z * (L - 0.3));
  const fi = fielderFor(dir);
  const T_ROPE = C + 2.3;
  const clip = {
    duration: 7,
    bursts: [{ t: T_ROPE - 0.1, text: freeHit ? "FREE HIT · FOUR!" : "FOUR!", tone: "four" }],
    update(t) {
      const st = base(t, { swing: style });
      if (t >= C) {
        const g = 1 - Math.pow(1 - seg(t, C, T_ROPE), 1.7);
        const p = mix(SC, edge, g);
        p.y = 0.08 + Math.abs(Math.sin(g * PI * 3)) * (1 - g) * 0.9;
        st.ball = t < T_ROPE + 1.2 ? p : null;
      }
      st.striker.look = isVec(st.ball) ? st.ball : edge;
      const home = fpos(st, fi);
      const chase = v3(edge.x - dir.x * 2.5 + dir.z * 2.2, 0, edge.z - dir.z * 2.5 - dir.x * 2.2);
      Object.assign(st.fielders[fi], runTo(home, chase, seg(t, C + 0.2, T_ROPE - 0.15)), { time: t });
      if (t > T_ROPE - 0.35) Object.assign(st.fielders[fi], { pose: "dive", run: 0, fall: lerp(0, 1.35, seg(t, T_ROPE - 0.35, T_ROPE)), face: faceTo(chase, edge), ...reachBall(st.ball) });
      if (t > T_ROPE + 0.9) Object.assign(st.fielders[fi], { fall: lerp(1.35, 0, seg(t, T_ROPE + 0.9, T_ROPE + 1.4)), pose: "dejected", reachL: null, reachR: null });
      if (t > T_ROPE + 0.7) st.umpire = { ...st.umpire, pose: "umpFour", add: { shR: [0, 0, Math.sin(t * 7) * 0.7] } };
      if (t > T_ROPE + 0.4) st.striker = { ...st.striker, pose: "stand", bat: undefined, face: -PI / 2 + 0.5, look: edge };
      const cam = t < C + 0.12 ? CAM.open(t, st) : t < C + 0.9 ? CAM.follow(dir, st.ball) : t < T_ROPE + 0.7 ? CAM.spider(isVec(st.ball) ? st.ball : edge) : CAM.hero(st.striker, 2.8, 0.1);
      return { st, cam, excite: t > T_ROPE - 0.3 ? 0.8 : 0.1, screen: t > T_ROPE ? { big: "FOUR!", small: nameOf(m, "striker"), color: "#7cc4ff" } : null };
    },
  };
  return withReplay(withReplay(withDecision(withCrowd(clip, 1.4), "four"), { from: C - 0.45, to: C + 0.6, cam: () => CAM.batter() }), { from: C - 0.22, to: C + 0.3, rate: 0.2, cam: () => ({ id: "contact", pos: v3(-3.1, 1.25, -7.3), look: v3(0.15, 0.85, -8.9), fov: 34 }), label: "SUPER SLOW-MO" });
}

function caughtClip(m, { dropped = false, diving = false, how = "c" } = {}) {
  if (how === "cb") return caughtAndBowled(m);
  const dir = shotDir(m, "air");
  const style = styleFor(dir, true);
  const fi = fielderFor(dir);
  const home0 = v3(FIELD[fi].x, 0, FIELD[fi].z);
  const along = Math.max(12, (home0.x - S0.x) * dir.x + (home0.z - S0.z) * dir.z);
  const proj = v3(S0.x + dir.x * along, 0, S0.z + dir.z * along);
  let catchPt = mix(home0, proj, 0.75);
  const sideV = v3(dir.z, 0, -dir.x);
  if (diving) catchPt = v3(catchPt.x + sideV.x * 3.5, 0, catchPt.z + sideV.z * 3.5);
  const T_CATCH = C + 2.3;
  const hands = v3(catchPt.x, diving ? 0.55 : 2.05, catchPt.z);
  const dropTo = v3(catchPt.x + dir.x * 2, 0.04, catchPt.z + dir.z * 2);
  const clip = {
    duration: 8.2,
    bursts: dropped ? [{ t: T_CATCH + 0.3, text: "DROPPED!", tone: "funny" }] : [{ t: T_CATCH + 0.2, text: diving ? "WHAT A CATCH!" : "CAUGHT!", tone: "w" }],
    update(t) {
      const st = base(t, { swing: style });
      if (t >= C) {
        if (t < T_CATCH) st.ball = flight(SC, hands, 12 + along * 0.2, seg(t, C, T_CATCH));
        else if (dropped) {
          const s = seg(t, T_CATCH, T_CATCH + 0.9);
          const roll = seg(t, T_CATCH + 0.9, T_CATCH + 2) * 2;
          st.ball = s < 1 ? arc(hands, dropTo, 1.4, s) : v3(dropTo.x + dir.x * roll, 0.04, dropTo.z + dir.z * roll);
        } else st.ball = { hand: "fielder", i: fi };
      }
      const ballV = isVec(st.ball) ? st.ball : null;
      const home = fpos(st, fi);
      const s = seg(t, C + 0.15, T_CATCH - 0.35);
      const f = { ...runTo(home, catchPt, s), time: t, look: ballV };
      if (t > T_CATCH - 0.7 && t <= T_CATCH) Object.assign(f, { pose: diving ? "dive" : "catchHigh", face: faceTo(catchPt, S0), ...reachBall(ballV) });
      if (diving && t > T_CATCH - 0.4) Object.assign(f, { fall: lerp(0, -1.35, seg(t, T_CATCH - 0.4, T_CATCH)), jump: 0.3 * Math.sin(seg(t, T_CATCH - 0.4, T_CATCH + 0.1) * PI), run: 0 });
      if (diving && t > T_CATCH) Object.assign(f, { pose: "dive", fall: lerp(-1.35, 0, seg(t, T_CATCH + 1.0, T_CATCH + 1.6)), face: faceTo(catchPt, S0) });
      if (!dropped && t > T_CATCH + (diving ? 1.6 : 0.35)) Object.assign(f, celebrate(t, fi), { face: faceTo(catchPt, S0) });
      if (dropped && t > T_CATCH) Object.assign(f, { pose: t < T_CATCH + 1.4 ? "handsHead" : "squat", face: faceTo(catchPt, dropTo), look: null });
      st.fielders[fi] = f;
      if (!dropped && t > T_CATCH + 1) mob(t, st, T_CATCH + 1, catchPt, fi);
      if (t > C + 0.45) {
        const r = seg(t, C + 0.45, T_CATCH);
        st.striker = { x: 0.9, z: lerp(STRIKER.z, -4, r), face: 0, run: r < 1 ? 1 : 0, pose: "stand", time: t, bat: undefined, look: ballV };
        st.nonStriker = { ...st.nonStriker, z: lerp(9.3, 4.5, r), face: PI, run: r < 1 ? 1 : 0, time: t + 1 };
      }
      if (!dropped && t > T_CATCH + 0.7) walkOff(t, T_CATCH + 0.7, st);
      if (dropped && t > T_CATCH + 0.4) st.striker = { ...st.striker, ...celebrate(t, 3, 0.4), pose: "fistPump", face: faceTo(st.striker, catchPt) };
      if (!dropped && t > T_CATCH + 1.2) st.umpire.pose = "umpOut";
      const cam = t < C + 0.12 ? CAM.open(t, st) : t < T_CATCH + 0.8 ? CAM.follow(dir, ballV) : CAM.orbit(catchPt, t, 9, 3);
      const screen = t > T_CATCH + 0.2 ? (dropped ? { big: "DROPPED!", small: "Let off!", color: "#c6f45b" } : { big: "OUT!", small: [nameOf(m, "out") || nameOf(m, "striker"), nameOf(m, "fielder") && `c ${nameOf(m, "fielder")}`].filter(Boolean).join(" "), color: "#ff5d6c" }) : null;
      return { st, cam, excite: t > T_CATCH ? 1 : 0.15, screen };
    },
  };
  const near = (tt, s) => {
    const p = v3(s.fielders[fi].x, 0, s.fielders[fi].z);
    return { id: "catchcam", pos: v3(p.x + sideV.x * 6 - dir.x * 3, 1.9, p.z + sideV.z * 6 - dir.z * 3), look: v3(p.x, 1.4, p.z), fov: 30 };
  };
  return withReplay(dropped ? clip : withDecision(withCrowd(clip, 1.5), "out"), { from: T_CATCH - 0.9, to: T_CATCH + 0.5, rate: 0.35, cam: near });
}

function caughtAndBowled(m) {
  const T = C + 0.45;
  const at = v3(1.6, 0, 8.0);
  const clip = {
    duration: 7.8,
    bursts: [{ t: T + 0.2, text: "CAUGHT & BOWLED!", tone: "w" }],
    update(t) {
      const st = base(t, { swing: "drive" });
      if (t >= C) st.ball = t < T ? arc(SC, v3(at.x, 0.6, at.z - 0.6), 0.9, seg(t, C, T)) : { hand: "bowler" };
      if (t > C) st.bowler = { x: at.x, z: at.z, face: PI, pose: "dive", back: -lerp(0, 1.2, seg(t, C, T)), ...reachBall(isVec(st.ball) ? st.ball : null) };
      if (t > T + 0.7) st.bowler = { x: at.x, z: at.z, face: 0, ...celebrate(t) };
      if (t > T + 1) mob(t, st, T + 1, at);
      if (t > T + 0.8) walkOff(t, T + 0.8, st);
      const cam = t < C - 0.05 ? CAM.open(t, st) : t < T + 1.2 ? { id: "cb", pos: v3(6, 2.0, 3), look: v3(1.5, 0.8, 8.2), fov: 30 } : CAM.orbit(at, t, 8, 3);
      return { st, cam, excite: t > T ? 1 : 0.1, screen: t > T ? { big: "OUT!", small: `c & b ${nameOf(m, "bowler")}`, color: "#ff5d6c" } : null };
    },
  };
  return withReplay(withDecision(clip, "out"), { from: C - 0.3, to: T + 0.3, cam: () => ({ id: "cbr", pos: v3(-3, 1.2, 5.5), look: v3(1.4, 0.7, 8), fov: 28 }) });
}

function bowledClip(m, { duck = false, mobAt = null } = {}) {
  const HIT = C + 0.1;
  const at = v3(7, 0, 2);
  const clip = {
    duration: duck ? 10 : 8,
    bursts: [{ t: HIT + 0.3, text: "BOWLED!", tone: "w" }, ...(duck ? [{ t: 4.8, text: "🦆 DUCK!", tone: "funny" }] : []), ...(mobAt ? [{ t: 5.2, text: mobAt, tone: "star" }] : [])],
    update(t) {
      const st = base(t, { swing: "drive", late: 0.1 });
      if (t >= C) st.ball = t < HIT ? mix(v3(0.05, 0.4, -8.5), v3(0, 0.45, -10), seg(t, C, HIT)) : t < HIT + 0.8 ? arc(v3(0, 0.45, -10), v3(0.6, 0.04, -14), 0.6, seg(t, HIT, HIT + 0.8)) : null;
      st.stumpsBat = t - HIT;
      st.stumpsWild = 1.6;
      if (t > HIT + 0.3) st.striker = { ...st.striker, face: lerp(-PI / 2, -PI + 0.3, seg(t, HIT + 0.3, HIT + 0.8)), look: v3(0, 0.3, -10.4) };
      if (t > HIT + 0.3) {
        const from = v3(1.8, 0, 6.6);
        const s = seg(t, HIT + 0.3, HIT + 2.2);
        st.bowler = { ...runTo(from, at, s), pose: "airplane", keepArms: true, time: t };
        if (s >= 1) Object.assign(st.bowler, celebrate(t), { face: PI });
        mob(t, st, HIT + 1.2, at);
      }
      if (t > HIT + 1.8) walkOff(t, HIT + 1.8, st);
      if (duck && t > 4) {
        const behind = mix(v3(STRIKER.x, 0, STRIKER.z), PAVILION, Math.max(0, seg(t, HIT + 1.8, HIT + 17.8) - 0.06));
        st.duck = { x: behind.x + 1, z: behind.z - 1.6, face: faceTo(STRIKER, PAVILION), t };
      }
      const cam =
        t < C + 0.15 ? CAM.open(t, st) : duck && t > 4.2 ? { id: "duck", pos: v3(st.striker.x + 10, 3.2, st.striker.z + 7), look: v3(st.striker.x, 0.9, st.striker.z - 1), fov: 34, ease: 3 } : t < HIT + 1.4 ? CAM.side() : CAM.orbit(at, t, 10, 3.2);
      return { st, cam, excite: t > HIT ? 0.9 : 0.1, screen: t > HIT + 0.3 ? { big: mobAt ? mobAt.replace("!", "") : "BOWLED!", small: nameOf(m, "bowler"), color: "#ff5d6c" } : null };
    },
  };
  return withReplay(withDecision(withCrowd(clip, 1.5), "out"), { from: C - 0.4, to: HIT + 0.6, rate: 0.3, cam: () => CAM.stump() });
}

function lbwClip(m) {
  const T_UMP = C + 1.6;
  const at = v3(4, 0, 6);
  const clip = {
    duration: 8.4,
    bursts: [{ t: C + 0.35, text: "HOWZAT?!", tone: "x" }, { t: T_UMP + 0.1, text: "OUT! LBW", tone: "w" }],
    update(t) {
      const st = base(t, { swing: "drive", late: 0.16 });
      if (t >= C) st.ball = t < C + 0.6 ? arc(v3(0.2, 0.35, -8.85), v3(1.8, 0.04, -6.8), 0.5, seg(t, C, C + 0.6)) : v3(1.8 + seg(t, C + 0.6, C + 1.6) * 0.8, 0.04, -6.8 + seg(t, C + 0.6, C + 1.6) * 0.6);
      if (t > C + 0.2 && t < T_UMP + 0.6) st.bowler = { x: 1.8, z: 6.6, face: lerp(PI, 0.2, seg(t, C + 0.2, C + 0.5)), pose: "appeal", jump: Math.abs(Math.sin((t - C) * 5)) * 0.22, look: v3(UMP.x, 1.7, UMP.z) };
      if (t > C + 0.3 && t < T_UMP + 0.6) {
        st.fielders[0] = { ...st.fielders[0], pose: "appeal" };
        st.fielders[1] = { ...st.fielders[1], pose: "appeal" };
      }
      if (t > T_UMP) st.umpire = { ...st.umpire, pose: "umpOut" };
      if (t > T_UMP + 0.6) {
        const s = seg(t, T_UMP + 0.6, T_UMP + 1.8);
        st.bowler = { ...runTo(v3(1.8, 0, 6.6), at, s), pose: "airplane", keepArms: true, time: t };
        if (s >= 1) Object.assign(st.bowler, celebrate(t));
        mob(t, st, T_UMP + 0.8, at);
        walkOff(t, T_UMP + 0.8, st);
      }
      const cam = t < C + 0.35 ? CAM.open(t, st) : t < T_UMP + 0.9 ? CAM.umpire() : CAM.orbit(at, t, 10, 3.2);
      return { st, cam, excite: t > T_UMP ? 0.9 : 0.25, screen: t > T_UMP ? { big: "OUT!", small: `lbw b ${nameOf(m, "bowler")}`, color: "#ff5d6c" } : { big: "HOWZAT?", small: "Umpire's call…" } };
    },
  };
  const R = v3(0.55, 2.2, 9.45);
  const B = v3(0.05, 0.04, -3.6);
  const I = v3(0.2, 0.35, -8.85);
  const S = v3(0.06, 0.42, -10.05);
  const path = [...Array(21)].map((_, i) => arc(R, B, 0.12, i / 20)).concat([...Array(11)].map((_, i) => arc(B, I, 0.18, (i + 1) / 11)));
  return withHawkEye(withReplay(withDecision(clip, "out"), { from: C - 0.4, to: C + 0.3, rate: 0.3, cam: () => CAM.side(-9) }), { freezeAt: C + 0.05, path, pitch: B, impact: I, stumps: S });
}

function stumpedClip(m) {
  const T_GLOVE = C + 0.28;
  const T_BREAK = C + 0.5;
  const clip = {
    duration: 7.6,
    bursts: [{ t: T_BREAK + 0.35, text: "STUMPED!", tone: "w" }],
    update(t) {
      const st = base(t, { swing: "loft", late: 0.08 });
      const adv = smooth(seg(t, 1.7, 2.3));
      const back = smooth(seg(t, C + 0.35, C + 0.95));
      st.striker = { ...st.striker, z: STRIKER.z + adv * 1.9 - back * 0.9, run: (adv > 0 && adv < 1) || (back > 0 && back < 1) ? 0.6 : 0, time: t };
      if (t > C + 0.35) st.striker = { ...st.striker, face: 0, pose: "stand", bat: undefined };
      if (t >= C) st.ball = t < T_GLOVE ? mix(v3(0.15, 0.7, -7.3), v3(0.1, 0.7, -12.9), seg(t, C, T_GLOVE)) : { hand: "fielder", i: 0 };
      if (t > C - 0.2) st.fielders[0] = { x: 0.1, z: lerp(-13.4, -11.0, seg(t, T_GLOVE, T_BREAK)), face: 0, pose: "keeperUp", ...reachBall(t < T_GLOVE ? st.ball : v3(0.1, 0.65, lerp(-12.9, -10.3, seg(t, T_GLOVE, T_BREAK)))) };
      st.stumpsBat = t - T_BREAK;
      st.stumpsWild = 0.6;
      if (t > T_BREAK + 1) {
        const k = v3(0.1, 0, -11);
        st.fielders[0] = { x: k.x, z: k.z, face: PI, ...celebrate(t) };
        mob(t, st, T_BREAK + 1.2, k, 0);
        walkOff(t, T_BREAK + 1.6, st);
      }
      if (t > T_BREAK + 1.2) st.umpire.pose = "umpOut";
      const cam = t < C - 0.1 ? CAM.open(t, st) : t < T_BREAK + 1.4 ? CAM.side(-10) : CAM.orbit(v3(0, 0, -11), t, 9, 3);
      return { st, cam, excite: t > T_BREAK ? 0.9 : 0.1, screen: t > T_BREAK + 0.3 ? { big: "STUMPED!", small: nameOf(m, "bowler"), color: "#ff5d6c" } : null };
    },
  };
  return withReplay(withDecision(clip, "out"), { from: C + 0.1, to: T_BREAK + 0.3, rate: 0.3, cam: () => ({ id: "stbehind", pos: v3(-3.5, 1.0, -11.5), look: v3(0, 0.5, -9.5), fov: 30 }) });
}

function runOutClip(m) {
  const dir = shotDir({ ...m, play: { ...m.play, shot: m.play?.shot || { a: 72 } } });
  const fi = fielderFor(dir);
  const home0 = v3(FIELD[fi].x, 0, FIELD[fi].z);
  const pick = mix(home0, v3(S0.x + dir.x * 16, 0, S0.z + dir.z * 16), 0.6);
  const T_PICK = C + 1.35;
  const T_THROW = T_PICK + 0.3;
  const T_HIT = T_THROW + 0.6;
  const stumps = v3(0, 0.6, 10.2);
  const clip = {
    duration: 8.6,
    bursts: [{ t: C + 1.3, text: "Yes! No! Wait!", tone: "funny" }, { t: T_HIT + 0.35, text: "RUN OUT!", tone: "w" }],
    update(t) {
      const st = base(t, { swing: "drive" });
      if (t >= C) {
        if (t < T_PICK) st.ball = Object.assign(mix(SC, pick, easeOut(seg(t, C, T_PICK))), { y: 0.05 });
        else if (t < T_THROW + 0.05) st.ball = { hand: "fielder", i: fi };
        else st.ball = t < T_HIT ? arc(v3(pick.x, 2.0, pick.z), stumps, 1.5, seg(t, T_THROW, T_HIT)) : v3(0.3, 0.04, 10.5);
      }
      const home = fpos(st, fi);
      const f = { ...runTo(home, pick, seg(t, C + 0.2, T_PICK - 0.1)), time: t };
      if (t > T_PICK - 0.25 && t < T_PICK + 0.05) Object.assign(f, { pose: "pickup", run: 0, face: faceTo(pick, SC) });
      if (t >= T_PICK + 0.05) Object.assign(f, { run: 0, face: faceTo(pick, stumps), pose: keys(t, [[T_PICK + 0.05, "throwCock"], [T_THROW, "throwCock"], [T_THROW + 0.18, "throwRelease"], [T_THROW + 0.8, "stand"]]) });
      if (t > T_HIT + 0.3) Object.assign(f, celebrate(t, fi));
      st.fielders[fi] = f;
      if (t > C) st.bowler = { ...runTo(v3(1.8, 0, 6.6), v3(0.4, 0, 10.6), seg(t, C, T_PICK)), time: t, pose: "stand" };
      if (t > T_THROW) st.bowler = { x: 0.4, z: 10.6, face: faceTo(v3(0.4, 0, 10.6), pick), pose: "catchLow", ...reachBall(t < T_HIT ? st.ball : v3(0.1, 0.6, 10.2)) };
      if (t > T_HIT + 0.3) st.bowler = { x: 0.4, z: 10.6, face: PI, ...celebrate(t, 2) };
      st.stumpsBowl = t - T_HIT;
      if (t > C + 0.3) {
        const r = seg(t, C + 0.3, C + 3.4);
        st.striker = { x: 0.9, z: lerp(STRIKER.z, 6.4, r), face: 0, run: r < 1 ? 1 : 0, pose: "stand", time: t, bat: undefined };
        const go = seg(t, C + 0.2, C + 0.9);
        const back = seg(t, C + 1.25, T_HIT + 0.05);
        const z = lerp(lerp(9.3, 5.6, go), 7.8, back);
        const diving = back > 0.75;
        st.nonStriker = { x: -0.9, z, face: back > 0 ? 0 : PI, run: (go > 0 && go < 1) || (back > 0 && !diving) ? 1 : 0, time: t + 0.5, pose: diving ? "dive" : "stand", back: diving ? -lerp(0, 1.25, seg(back, 0.75, 1)) : 0 };
        if (t > C + 0.9 && t < C + 1.25) st.nonStriker.pose = "handsHead";
      }
      if (t > T_HIT + 1.4) st.nonStriker = { ...st.nonStriker, pose: "handsHead", back: 0, run: 0 };
      const cam = t < C + 0.12 ? CAM.open(t, st) : t < T_PICK + 0.1 ? CAM.follow(dir, st.ball) : t < T_HIT + 1.5 ? { id: "ro", pos: v3(9, 2.4, 6.5), look: v3(0, 0.8, 9.2), fov: 32 } : CAM.orbit(v3(0, 0, 8.5), t, 9, 3);
      return { st, cam, excite: t > T_HIT ? 1 : 0.3, screen: t > T_HIT + 0.3 ? { big: "RUN OUT!", small: nameOf(m, "out"), color: "#ff5d6c" } : null };
    },
  };
  return withReplay(withDecision(clip, "out"), { from: T_HIT - 0.5, to: T_HIT + 0.3, rate: 0.3, cam: () => ({ id: "rosq", pos: v3(-8, 1.2, 8.9), look: v3(0, 0.5, 9.2), fov: 26 }) });
}

function hitWicketClip() {
  const HIT = C + 0.18;
  const clip = {
    duration: 7.2,
    bursts: [{ t: HIT + 0.3, text: "HIT WICKET!", tone: "funny" }],
    update(t) {
      const st = base(t, { swing: "pull", late: 0.05 });
      const back = smooth(seg(t, 2.0, 2.4));
      st.striker = { ...st.striker, z: STRIKER.z - back * 0.75 };
      if (t >= C) st.ball = t < C + 0.4 ? mix(v3(0.15, 0.8, -8.85), KEEPER_GLOVES, seg(t, C, C + 0.4)) : { hand: "fielder", i: 0 };
      st.stumpsBat = t - HIT;
      if (t > HIT + 0.5) st.striker = { ...st.striker, pose: "handsHead", bat: undefined, face: -PI + 0.3, look: v3(0, 0.3, -10.4) };
      if (t > HIT + 0.8) st.fielders[0] = { ...st.fielders[0], ...celebrate(t) };
      if (t > HIT + 2.6) walkOff(t, HIT + 2.6, st);
      const cam = t < C - 0.1 ? CAM.open(t, st) : t < HIT + 2.6 ? CAM.side(-10) : CAM.orbit(v3(0, 0, -10), t, 9, 3);
      return { st, cam, excite: t > HIT ? 0.8 : 0.1, screen: t > HIT + 0.3 ? { big: "HIT WICKET", small: "Oops!", color: "#c6f45b" } : null };
    },
  };
  return withReplay(withDecision(clip, "out"), { from: C - 0.3, to: HIT + 0.5, rate: 0.3, cam: () => CAM.stump() });
}

// Wides: the ball goes well down the off side; with reps > 1 it happens again… and again.
function wideClip(m, reps = 1) {
  const P = 4.6;
  return {
    duration: P * reps + 1.2,
    bursts: Array.from({ length: reps }, (_, i) => ({ t: i * P + C + 0.7, text: reps > 1 ? `WIDE${"!".repeat(i + 1)}` : "WIDE!", tone: "x" })),
    update(t) {
      const lt = t - Math.min(reps - 1, Math.floor(t / P)) * P;
      const st = base(lt, { swing: "drive", late: 0.12, line: { bx: -1.3, cx: -2.2, cy: 0.9, cz: -8.9 } });
      if (lt >= C) st.ball = lt < C + 0.35 ? mix(v3(-2.2, 0.9, -8.9), v3(-1.6, 0.7, -13.2), seg(lt, C, C + 0.35)) : { hand: "fielder", i: 0 };
      if (lt > C - 0.1) st.fielders[0] = { x: lerp(0, -1.3, seg(lt, C - 0.1, C + 0.3)), z: -13.4, face: 0, pose: "keeperUp", fall: -0.5 * seg(lt, C, C + 0.3), ...reachBall(lt < C + 0.35 ? st.ball : null) };
      if (lt > C + 0.5) st.umpire = { ...st.umpire, pose: "umpWide" };
      if (reps > 1 && t > P * (reps - 1) + C + 1) st.bowler = { ...st.bowler, pose: "handsHead", run: 0 };
      const cam = lt < C + 0.4 ? CAM.open(lt, st) : CAM.umpire();
      return { st, cam, excite: 0.25, screen: lt > C + 0.5 ? { big: "WIDE", small: reps > 1 ? `${Math.min(reps, Math.floor(t / P) + 1)} in the over` : "+1 run", color: "#ffb86b" } : null };
    },
  };
}

// No-ball: front foot over the line → umpire's arm out → FREE HIT signal (circling arm).
function noBallClip(m, { runs = 0 } = {}) {
  const dir = dirFromAngle(40);
  const L = ropeDistance(dir);
  const edge = v3(S0.x + dir.x * (L - 0.3), 0.08, S0.z + dir.z * (L - 0.3));
  const clip = {
    duration: 7.2,
    bursts: [{ t: RELEASE + 0.6, text: "NO BALL!", tone: "x" }, { t: C + 2.6, text: "FREE HIT!", tone: "six" }],
    update(t) {
      const st = base(t, { swing: runs >= 4 ? "drive" : "defend", noBall: true });
      if (t >= C && runs >= 4) st.ball = Object.assign(mix(SC, edge, 1 - Math.pow(1 - seg(t, C, C + 2.2), 1.7)), { y: 0.08 });
      else if (t >= C) st.ball = arc(v3(0.25, 0.4, -8.5), v3(0.8, 0.04, -5.5), 0.4, easeOut(seg(t, C, C + 1.0)));
      if (t > RELEASE + 0.45 && t < C + 2.2) st.umpire = { ...st.umpire, pose: "umpNoBall" };
      if (t >= C + 2.2) st.umpire = { ...st.umpire, pose: "umpFreeHit", add: { shR: [Math.sin(t * 7) * 0.35, 0, Math.cos(t * 7) * 0.35] } };
      if (t > C + 1) st.bowler = { ...st.bowler, pose: "handsHead", run: 0 };
      const cam = t < RELEASE + 0.4 ? CAM.open(t, st) : CAM.umpire();
      return { st, cam, excite: 0.35, screen: t > C + 2.4 ? { big: "FREE HIT", small: "Next ball", color: "#ffd23f" } : t > RELEASE + 0.5 ? { big: "NO BALL", small: "+1 run", color: "#ffb86b" } : null };
    },
  };
  return withReplay(clip, { from: RELEASE - 0.45, to: RELEASE + 0.15, rate: 0.3, cam: () => CAM.foot() });
}

// A dot ball (well defended / free hit wasted / maiden).
function defendClip(m, { label = "DOT BALL", tone = "x" } = {}) {
  return {
    duration: 6,
    bursts: [{ t: C + 0.6, text: label, tone }],
    update(t) {
      const st = base(t, { swing: "defend" });
      if (t >= C) st.ball = arc(v3(0.25, 0.4, -8.5), v3(1.2, 0.04, -5), 0.3, easeOut(seg(t, C, C + 1.2)));
      if (t > C + 1.2) st.bowler = { ...st.bowler, pose: "handsHead", run: 0 };
      const cam = t < C + 0.3 ? CAM.open(t, st) : CAM.orbit(v3(STRIKER.x, 0, STRIKER.z), t, 6, 2);
      return { st, cam, excite: 0.1 };
    },
  };
}

function byesClip() {
  const dir = dirFromAngle(192);
  const L = ropeDistance(dir);
  const edge = v3(S0.x + dir.x * (L - 0.3), 0.06, S0.z + dir.z * (L - 0.3));
  const T_ROPE = C + 2.8;
  return withReplay(
    {
      duration: 7.6,
      bursts: [{ t: C + 0.6, text: "Through the keeper!", tone: "funny" }, { t: T_ROPE, text: "4 BYES!", tone: "x" }],
      update(t) {
        const st = base(t, { swing: "leave", line: { cx: 0.45, cy: 0.5, cz: -9.0 } });
        if (t >= C) st.ball = t < T_ROPE + 1 ? (t < C + 0.4 ? mix(v3(0.45, 0.5, -9), v3(0.9, 0.3, -14), seg(t, C, C + 0.4)) : mix(v3(0.9, 0.06, -14), edge, easeOut(seg(t, C + 0.4, T_ROPE)))) : null;
        if (t > C - 0.1) st.fielders[0] = { x: lerp(0, -1.4, seg(t, C - 0.1, C + 0.25)), z: -13.4, face: 0, pose: "dive", fall: -1.1 * seg(t, C - 0.1, C + 0.25), jump: 0.3 * Math.sin(seg(t, C - 0.1, C + 0.4) * PI) };
        if (t > C + 1.2) st.fielders[0] = { x: -1.4, z: -13.4, face: faceTo(v3(-1.4, 0, -13.4), edge), pose: "handsHead" };
        Object.assign(st.fielders[8], runTo(fpos(st, 8), v3(edge.x + 3, 0, edge.z + 3), seg(t, C + 0.6, T_ROPE)), { time: t });
        if (t > T_ROPE + 0.5) st.umpire = { ...st.umpire, pose: "umpBye" };
        const cam = t < C - 0.1 ? CAM.open(t, st) : t < C + 0.9 ? CAM.side(-12) : t < T_ROPE + 0.5 ? CAM.follow(dir, st.ball) : CAM.orbit(v3(-1.4, 0, -13.4), t, 7, 2.5);
        return { st, cam, excite: 0.4, screen: t > T_ROPE ? { big: "4 BYES", small: "Keeper missed it", color: "#ffb86b" } : null };
      },
    },
    { from: C - 0.2, to: C + 0.5, rate: 0.3, cam: () => CAM.stump() }
  );
}

function slipClip() {
  const dir = dirFromAngle(330);
  const fi = fielderFor(dir);
  const L = ropeDistance(dir);
  const edge = v3(S0.x + dir.x * (L - 0.3), 0.06, S0.z + dir.z * (L - 0.3));
  const T_SLIP = C + 1.15;
  const T_ROPE = C + 3.2;
  return {
    duration: 7.8,
    bursts: [{ t: T_SLIP + 0.2, text: "OOPS!", tone: "funny" }, { t: T_ROPE, text: "FOUR!", tone: "four" }],
    slow: [[T_SLIP - 0.3, T_SLIP + 0.6, 0.4]],
    update(t) {
      const st = base(t, { swing: "drive" });
      if (t >= C) st.ball = t < T_ROPE + 1 ? Object.assign(mix(SC, edge, Math.pow(seg(t, C, T_ROPE), 0.85)), { y: 0.06 }) : null;
      const home = fpos(st, fi);
      const meet = mix(home, v3(S0.x + dir.x * 26, 0, S0.z + dir.z * 26), 0.7);
      const f = { ...runTo(home, meet, seg(t, C + 0.1, T_SLIP)), time: t };
      if (t > T_SLIP) Object.assign(f, { run: 0, pose: "lyingBack", back: lerp(0, 1.45, seg(t, T_SLIP, T_SLIP + 0.3)), jump: 0.45 * Math.sin(seg(t, T_SLIP, T_SLIP + 0.35) * PI), face: faceTo(home, meet) });
      st.fielders[fi] = f;
      if (t > C + 0.5) {
        const r = seg(t, C + 0.5, C + 3.3);
        st.striker = { x: 0.9, z: lerp(STRIKER.z, 8.2, r), face: 0, run: r < 1 ? 1 : 0, pose: "stand", bat: undefined, time: t };
        st.nonStriker = { x: -0.9, z: lerp(9.3, -8.2, r), face: PI, run: r < 1 ? 1 : 0, pose: "stand", time: t + 0.5 };
        if (r >= 1) Object.assign(st.striker, celebrate(t, 1, 0.4), { pose: "fistPump" });
      }
      const cam = t < C + 0.12 ? CAM.open(t, st) : t < T_SLIP + 1.3 ? { id: "slip", pos: v3(meet.x - dir.z * 9 - dir.x * 4, 3, meet.z + dir.x * 9 - dir.z * 4), look: v3(meet.x, 0.6, meet.z), fov: 32, ease: 4 } : CAM.follow(dir, st.ball);
      return { st, cam, excite: 0.6, screen: t > T_SLIP ? { big: "OOPS!", small: "Butter fingers", color: "#c6f45b" } : null };
    },
  };
}

function milestoneClip(m, label) {
  const at = v3(0.9, 0, 8.9);
  return {
    duration: 7.4,
    bursts: [{ t: 1.2, text: label, tone: "star" }],
    update(t) {
      const st = base(5, {});
      st.ball = null;
      st.bowler = { x: 3, z: 14, face: faceTo(v3(3, 0, 14), at), pose: "clap", add: clapAdd(t) };
      const r = seg(t, 0, 1);
      st.striker = { x: 0.9, z: lerp(4, at.z, r), face: 0, run: r < 1 ? 1 : 0, pose: "stand", bat: undefined, time: t };
      if (t > 1) st.striker = { x: at.x, z: at.z, face: lerp(0, -PI / 2, seg(t, 1, 1.5)), pose: "batRaise", bat: undefined, batTilt: 0.1, jump: t < 1.6 ? Math.sin(seg(t, 1, 1.6) * PI) * 0.35 : 0 };
      const hug = seg(t, 1.6, 3.0);
      st.nonStriker = { ...runTo(v3(-0.9, 0, -8.6), v3(at.x + 0.7, 0, at.z - 0.7), hug), pose: hug >= 1 ? "clap" : "stand", add: hug >= 1 ? clapAdd(t) : null, time: t };
      st.fielders.forEach((f, i) => Object.assign(f, { pose: "clap", add: clapAdd(t + i), face: faceTo(f, at) }));
      st.umpire = { ...st.umpire, pose: "clap", add: clapAdd(t) };
      st.confetti = label.includes("HUNDRED") ? t - 1.2 : -1;
      st.confettiAt = [at.x, at.z];
      return { st, cam: CAM.orbit(at, t + 4, 6.5, 2.2), excite: 0.9, screen: { big: label.replace("!", ""), small: nameOf(m, "striker") || m.title, color: "#c6f45b" } };
    },
  };
}

// Whole team runs in and celebrates (result, last-over thriller).
function celebrateClip(label, sub = "") {
  const c = v3(0, 0, 2);
  return {
    duration: 8,
    winners: true,
    bursts: [{ t: 1.6, text: label, tone: "star" }],
    update(t) {
      const st = base(5, {});
      st.ball = null;
      const ring = [st.bowler, ...st.fielders];
      ring.forEach((p, i) => {
        const home = v3(p.x, 0, p.z);
        const a = (i / ring.length) * PI * 2;
        const target = v3(c.x + Math.sin(a) * 3.2, 0, c.z + Math.cos(a) * 3.2);
        const s = seg(t, 0, Math.max(0.6, dist2(home, target) / 9));
        const out = { ...runTo(home, target, s), time: t + i, pose: "stand" };
        if (s >= 1) Object.assign(out, celebrate(t * 1.1, i), { face: faceTo(target, c) });
        if (i === 0) st.bowler = out;
        else st.fielders[i - 1] = out;
      });
      walkOff(t + 4, 4, st);
      st.nonStriker = { x: -2, z: 4 - t * 1.2, face: PI, run: 0.35, pose: "dejected", time: t * 0.5 };
      st.umpire = { ...st.umpire, pose: "clap", add: clapAdd(t) };
      st.confetti = t - 1.2;
      st.confettiAt = [c.x, c.z];
      return { st, cam: t < 1.3 ? CAM.wide() : CAM.orbit(c, t, 15, 5.5), excite: 1, screen: { big: label.replace("!", ""), small: sub, color: "#c6f45b" } };
    },
  };
}

// Stadium fly-in before the first highlight.
function introClip(m) {
  return {
    duration: 6,
    bursts: [],
    update(t) {
      const st = base(0, {});
      st.ball = null;
      const a = 0.9 + t * 0.32;
      const k = smooth(seg(t, 0, 6));
      return {
        st,
        cam: { id: "intro", pos: v3(Math.sin(a) * lerp(150, 45, k), lerp(70, 9, k), Math.cos(a) * lerp(150, 45, k)), look: v3(0, 0, 0), fov: 45, ease: 50 },
        excite: 0.5,
        screen: { big: m.title || "HIGHLIGHTS", small: m.text || "" },
      };
    },
  };
}

// Pick the clip that best acts out a moment.
export function clipFor(m) {
  const title = (m.title || "").toUpperCase();
  const play = m.play || {};
  const how = play.how;
  const r = hash(m.id || title);
  if (m.kind === "intro") return introClip(m);
  // a boundary off a free hit: show the no-ball and free-hit call first
  if (play.fh && (m.kind === "six" || m.kind === "four")) return sequence([noBallClip(m), m.kind === "six" ? sixClip(m, { freeHit: true }) : fourClip(m, { freeHit: true })]);
  switch (m.kind) {
    case "six":
      return sixClip(m, { noBall: play.extra === "nb" });
    case "four":
      return fourClip(m);
    case "noball":
      return play.runs >= 6 ? sixClip(m, { noBall: true }) : noBallClip(m, { runs: play.runs || 0 });
    case "freehit":
      return sequence([noBallClip(m), defendClip(m, { label: "FREE HIT WASTED!", tone: "funny" })]);
    case "wide":
      return withDecision(wideClip(m, Math.min(3, Math.max(1, play.count || 1))), "wide");
    case "wicket": {
      const h = how || ["b", "c", "lbw", "c", "b"][Math.floor(r * 5)];
      if (h === "b") return bowledClip(m);
      if (h === "c" || h === "cb") return caughtClip(m, { how: h });
      if (h === "lbw") return lbwClip(m);
      if (h === "st") return stumpedClip(m);
      if (h === "ro") return runOutClip(m);
      if (h === "hw") return hitWicketClip(m);
      return bowledClip(m);
    }
    case "catch":
      return caughtClip(m, { diving: true });
    case "drop":
      return caughtClip(m, { dropped: true });
    case "milestone":
      return milestoneClip(m, title.includes("HUNDRED") ? "HUNDRED!" : title.includes("PARTNERSHIP") ? "PARTNERSHIP!" : title.includes(" UP") ? title.split(" ")[0] + " UP!" : "FIFTY!");
    case "result":
      return celebrateClip("WINNERS!", m.title);
    case "star":
      if (title.includes("HAT-TRICK")) return bowledClip(m, { mobAt: "HAT-TRICK!" });
      if (title.includes("TWO IN TWO")) return bowledClip(m, { mobAt: "ON A HAT-TRICK!" });
      if (title.includes("FIVE-FOR")) return bowledClip(m, { mobAt: "FIVE-FOR!" });
      if (title.includes("WICKETS")) return bowledClip(m, { mobAt: title.split(" · ")[0] + "!" });
      if (title.includes("MAIDEN")) return defendClip(m, { label: "MAIDEN OVER", tone: "star" });
      if (title.includes("THRILLER")) return celebrateClip("WHAT A FINISH!", m.text);
      return sixClip(m);
    case "funny":
      if (title.includes("DUCK")) return bowledClip(m, { duck: true });
      if (title.includes("WIDE")) return wideClip(m, Math.min(3, play.count || 3));
      if (title.includes("EXTRAS")) return wideClip(m, 2);
      if (title.includes("HIT WICKET")) return hitWicketClip(m);
      if (title.includes("MIX-UP")) return runOutClip(m);
      if (title.includes("BYES")) return byesClip(m);
      if (title.includes("NO-BALL")) return sixClip(m, { noBall: true });
      if (title.includes("FREE HIT")) return sequence([noBallClip(m), defendClip(m, { label: "FREE HIT WASTED!", tone: "funny" })]);
      if (title.includes("EXPENSIVE") || title.includes("DAY TO FORGET")) return sixClip(m);
      if (title.includes("HERO TO ZERO") || title.includes("NINETIES") || title.includes("FIFTY")) return caughtClip(m, { how: "c" });
      return slipClip(m);
    default:
      return r < 0.5 ? slipClip(m) : milestoneClip(m, "WHAT A MOMENT!");
  }
}

// Apply a clip frame to the world.
export function applyFrame(w, frame, t) {
  const st = frame.st;
  const ballVec = isVec(st.ball) ? st.ball : null;
  const lookAt = ballVec || v3(STRIKER.x, 1.2, STRIKER.z);
  const P = (player, s, i) => player.pose({ time: t + i * 0.37, ...s, look: s.look === undefined ? lookAt : s.look });
  P(w.striker, { ...st.striker, look: st.striker.look === undefined ? ballVec || BOWLER_LOOK : st.striker.look }, 0);
  P(w.nonStriker, st.nonStriker, 1);
  P(w.bowler, st.bowler, 2);
  P(w.umpire, st.umpire, 3);
  st.fielders.forEach((f, i) => P(w.fielders[i], { ...f, face: f.face === undefined ? faceTo(f, ballVec || S0) : f.face }, i + 4));
  // ball: in the bowler's hand before release, in a fielder's hands after a catch, or free
  let b = ballVec;
  const held = !ballVec && !!st.ball;
  if (st.ball === "hand" || st.ball?.hand === "bowler") b = w.bowler.handPos("R");
  else if (st.ball?.hand === "fielder") {
    const f = w.fielders[st.ball.i];
    b = f.handPos("L").add(f.handPos("R")).multiplyScalar(0.5);
  }
  w.setBall(b, !held);
  w.setHawkEye?.(frame.hawk || null);
  w.stumps.bat.pose(st.stumpsBat ?? -1, 1, st.stumpsWild || 1);
  w.stumps.bowl.pose(st.stumpsBowl ?? -1, -1, 1);
  const d = w.duck;
  d.group.visible = !!st.duck;
  if (st.duck) {
    d.group.position.set(st.duck.x, 0, st.duck.z);
    d.group.rotation.set(0, st.duck.face, Math.sin(st.duck.t * 9) * 0.18);
    d.feet.forEach((f, i) => (f.position.z = 0.1 + Math.sin(st.duck.t * 9 + i * PI) * 0.12));
  }
  w.confetti.pose(st.confetti ?? -1, ...(st.confettiAt || [0, 0]));
  w.setExcite(frame.excite ?? 0.1);
}
