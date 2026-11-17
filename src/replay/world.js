// 3D cricket world for highlight replays: a full stadium (two-tier stands, roof, floodlights,
// LED boards, big screen, thousands of spectators that react), a mown outfield and worn pitch,
// sun + shadows, and rigged players (see player.js). Everything is generated in code, so it
// works offline. Units are metres: striker's stumps at z = -10, bowler's at z = +10, y up.
// Viewed from behind the striker, the off side (for a right-hander) is -x.
import * as THREE from "three";
import { Player } from "./player.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createPipeline } from "./pipeline.js";
import { detailNormal } from "./textures.js";
import { lookFor } from "./look.js";
import { DEFAULT_GROUND, LIGHTS, findGround } from "./grounds.js";

export const STRIKER_Z = -10;
export const BOWLER_Z = 10;
export const BOUNDARY = 64;

// ---------- small math helpers (shared with clips) ----------
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const lerp = (a, b, s) => a + (b - a) * s;
export const seg = (t, a, b) => clamp01((t - a) / (b - a));
export const smooth = (s) => s * s * (3 - 2 * s);
export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const mix = (p0, p1, s) => v3(lerp(p0.x, p1.x, s), lerp(p0.y, p1.y, s), lerp(p0.z, p1.z, s));
// Parabola from p0 to p1 with peak h above the straight line.
export const arc = (p0, p1, h, s) => v3(lerp(p0.x, p1.x, s), lerp(p0.y, p1.y, s) + 4 * h * s * (1 - s), lerp(p0.z, p1.z, s));
// Lofted hit with air drag: covers ground fast early and slows late.
export function flight(p0, p1, h, s) {
  const k = 1.6;
  const g = (1 - Math.exp(-k * s)) / (1 - Math.exp(-k));
  return v3(lerp(p0.x, p1.x, g), lerp(p0.y, p1.y, g) + 4 * h * g * (1 - g), lerp(p0.z, p1.z, g));
}

// ---------- seeded random ----------
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// ---------- canvas textures ----------
export function canvasTex(w, h, draw, { repeat, srgb = true } = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  t.anisotropy = 8;
  return t;
}

function grassTex(size, colors = ["#4f9d41", "#3e8a35"], mowing = "stripes") {
  const r = rng(7);
  return canvasTex(size, size, (g, w, h) => {
    const span = (BOUNDARY + 12) * 2;
    const stripes = Math.round(span / 6); // ~6 m mowing stripes
    if (mowing === "circles") {
      g.fillStyle = colors[0];
      g.fillRect(0, 0, w, h);
      for (let i = Math.ceil(stripes / 2); i > 0; i--) {
        g.fillStyle = colors[i % 2];
        g.beginPath();
        g.arc(w / 2, h / 2, (i * w) / stripes, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      for (let i = 0; i < stripes; i++) {
        for (let j = 0; j < (mowing === "checks" ? stripes : 1); j++) {
          g.fillStyle = colors[(i + j) % 2];
          if (mowing === "checks") g.fillRect((j * w) / stripes, (i * h) / stripes, w / stripes + 1, h / stripes + 1);
          else g.fillRect(0, (i * h) / stripes, w, h / stripes + 1);
        }
      }
    }
    for (let i = 0; i < size * 60; i++) {
      g.fillStyle = r() < 0.5 ? `rgba(30,70,25,${0.08 + r() * 0.12})` : `rgba(140,190,90,${0.05 + r() * 0.08})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    const cx = w / 2;
    const cy = h / 2;
    const px = w / span;
    const patch = (x, y, rad, a) => {
      const grd = g.createRadialGradient(cx + x * px, cy + y * px, 0, cx + x * px, cy + y * px, rad * px);
      grd.addColorStop(0, `rgba(150,140,80,${a})`);
      grd.addColorStop(1, "rgba(150,140,80,0)");
      g.fillStyle = grd;
      g.fillRect(cx + (x - rad) * px, cy + (y - rad) * px, rad * 2 * px, rad * 2 * px);
    };
    patch(0, -14, 3.5, 0.35);
    patch(0, 14, 3.5, 0.25);
    patch(0, 24, 5, 0.12);
    g.fillStyle = "rgba(170,190,110,0.32)"; // the square (other pitches)
    g.fillRect(cx - 12 * px, cy - 13 * px, 24 * px, 26 * px);
  });
}

function pitchTex(colors = ["#b9a46b", "#d2bd84"]) {
  const r = rng(11);
  const W = 256;
  const H = 2048;
  const L = 24;
  const zpx = (z) => ((z + L / 2) / L) * H;
  const xpx = (x) => ((x + 1.525) / 3.05) * W;
  return canvasTex(W, H, (g) => {
    const grd = g.createLinearGradient(0, 0, W, 0);
    grd.addColorStop(0, colors[0]);
    grd.addColorStop(0.5, colors[1]);
    grd.addColorStop(1, colors[0]);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 26000; i++) {
      g.fillStyle = r() < 0.4 ? `rgba(120,140,70,${r() * 0.18})` : `rgba(90,70,40,${r() * 0.14})`;
      g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
    }
    g.strokeStyle = "rgba(80,60,35,0.35)";
    g.lineWidth = 1;
    for (let i = 0; i < 60; i++) {
      let x = r() * W;
      let y = r() * H;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) g.lineTo((x += (r() - 0.5) * 30), (y += (r() - 0.5) * 30));
      g.stroke();
    }
    for (const z of [-8.2, 8.2, -9.4, 9.4]) {
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(95,72,40,${0.15 + r() * 0.25})`;
        g.beginPath();
        g.ellipse(xpx((r() - 0.5) * 1.6), zpx(z + (r() - 0.5) * 1.6), 4 + r() * 6, 8 + r() * 10, r(), 0, Math.PI * 2);
        g.fill();
      }
    }
    for (const z of [-4, 4]) {
      const rg = g.createRadialGradient(W / 2, zpx(z), 0, W / 2, zpx(z), 160);
      rg.addColorStop(0, "rgba(120,95,55,0.35)");
      rg.addColorStop(1, "rgba(120,95,55,0)");
      g.fillStyle = rg;
      g.fillRect(0, zpx(z) - 160, W, 320);
    }
    g.fillStyle = "rgba(255,255,255,0.95)";
    const line = (x0, z0, x1, z1, wpx = 5) =>
      g.fillRect(Math.min(xpx(x0), xpx(x1)) - wpx / 2, Math.min(zpx(z0), zpx(z1)) - wpx / 2, Math.abs(xpx(x1) - xpx(x0)) + wpx, Math.abs(zpx(z1) - zpx(z0)) + wpx);
    for (const s of [-1, 1]) {
      const bz = s * 10;
      const pz = s * (10 - 1.22);
      line(-1.52, pz, 1.52, pz);
      line(-1.32, bz, 1.32, bz);
      for (const x of [-1.32, 1.32]) line(x, bz + s * 1.2, x, pz - s * 0.05);
      for (const x of [-0.89, 0.89]) line(x, pz, x, pz - s * 0.5, 4);
    }
  });
}

const crowdColors = {
  nrv: ["#ff7a2e", "#ffc81a", "#ff9a4d", "#f97316", "#fde047"],
  vpn: ["#22d3ee", "#3b82f6", "#0ea5e9", "#60a5fa", "#67e8f9"],
  other: ["#f4f4f4", "#e11d48", "#a3e635", "#c084fc", "#94a3b8", "#1f2937", "#fb7185", "#facc15"],
};
const skinTones = ["#f1c7a3", "#d9a37a", "#c68a5e", "#a8714a", "#8d5a3b", "#6b4429"];

function mergeGeos(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const count = parts.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return out;
}

// Instanced spectators that bob, jump and throw their arms up (animated on the GPU).
function makeCrowd(seats, home = crowdColors.other) {
  const r = rng(3);
  const n = seats.length;
  const bodyGeo = new THREE.CapsuleGeometry(0.2, 0.42, 2, 6);
  bodyGeo.translate(0, 0.42, 0);
  const headGeo = new THREE.SphereGeometry(0.12, 8, 6);
  headGeo.translate(0, 0.98, 0);
  const armL = new THREE.BoxGeometry(0.07, 0.5, 0.07);
  armL.rotateZ(-0.45);
  armL.translate(0.28, 1.05, 0);
  const armR = new THREE.BoxGeometry(0.07, 0.5, 0.07);
  armR.rotateZ(0.45);
  armR.translate(-0.28, 1.05, 0);
  const vArms = mergeGeos([armL, armR]);

  const phase = new Float32Array(n);
  for (let i = 0; i < n; i++) phase[i] = r();
  const uniforms = { uTime: { value: 0 }, uExcite: { value: 0 } };
  const patch = (arms) => (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uExcite = uniforms.uExcite;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aPhase;\nuniform float uTime;\nuniform float uExcite;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float ex = uExcite * step(0.3, fract(aPhase * 13.7));
        transformed.y += ex * abs(sin(uTime * 7.0 + aPhase * 40.0)) * 0.32 + 0.025 * sin(uTime * 1.3 + aPhase * 60.0);
        ${arms ? "transformed *= step(0.45, ex);" : ""}`
      );
  };
  const mk = (geo, arms) => {
    const m = new THREE.MeshLambertMaterial();
    m.onBeforeCompile = patch(arms);
    // the two patches look identical to three's program cache; keep them apart
    m.customProgramCacheKey = () => (arms ? "crowd-arms" : "crowd-body");
    const mesh = new THREE.InstancedMesh(geo, m, n);
    mesh.geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phase, 1));
    mesh.frustumCulled = false;
    return mesh;
  };
  const bodies = mk(bodyGeo, false);
  const heads = mk(headGeo, false);
  const arms = mk(vArms, true);
  const dummy = new THREE.Object3D();
  const c = new THREE.Color();
  const skin = new THREE.Color();
  seats.forEach((s, i) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, s.face, 0);
    dummy.scale.setScalar(0.9 + r() * 0.2);
    dummy.updateMatrix();
    bodies.setMatrixAt(i, dummy.matrix);
    heads.setMatrixAt(i, dummy.matrix);
    arms.setMatrixAt(i, dummy.matrix);
    const k = r();
    const pool = k < 0.42 ? crowdColors[s.side] || crowdColors.other : k < 0.82 ? home : crowdColors.other;
    c.set(pool[(r() * pool.length) | 0]);
    skin.set(skinTones[(r() * skinTones.length) | 0]);
    bodies.setColorAt(i, c);
    arms.setColorAt(i, skin);
    heads.setColorAt(i, skin);
  });
  return { meshes: [bodies, heads, arms], uniforms };
}

// Stepped stand profile for a LatheGeometry: rows of seats rising away from the field.
function standProfile(r0, y0, rows, tread, rise, wall = 1.2) {
  const pts = [new THREE.Vector2(r0, y0 - wall), new THREE.Vector2(r0, y0)];
  for (let i = 0; i < rows; i++) {
    const r = r0 + i * tread;
    const y = y0 + i * rise;
    pts.push(new THREE.Vector2(r + tread, y));
    pts.push(new THREE.Vector2(r + tread, y + rise));
  }
  const rEnd = r0 + rows * tread;
  pts.push(new THREE.Vector2(rEnd + 0.5, y0 + rows * rise));
  pts.push(new THREE.Vector2(rEnd + 0.5, y0 - wall));
  return pts;
}

const SIGHT_GAP = 0.16; // radians left empty behind each end for the sight screens

// arcs: [[start, length], …] in the lathe's angle (x = sin a · r, z = cos a · r; a = π is behind the
// striker's end, which the broadcast camera looks at)
const FULL = [[SIGHT_GAP, Math.PI - 2 * SIGHT_GAP], [Math.PI + SIGHT_GAP, Math.PI - 2 * SIGHT_GAP]];
const MAIN = [[Math.PI - 1.35, 1.35 - SIGHT_GAP], [Math.PI + SIGHT_GAP, 1.35 - SIGHT_GAP]]; // the main stand
const inArcs = (a, arcs) => {
  const x = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return arcs.some(([s, l]) => x >= s && x <= s + l);
};

function buildStadium(scene, quality, sides, G, L) {
  const out = {};
  const r0 = rng(G.id.length * 31 + G.name.charCodeAt(0));
  // ---- sky dome: gradient, sun glow, stars at night ----
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          sunDir: { value: v3(...L.sunPos).normalize() },
          top: { value: new THREE.Color(L.top) },
          horizon: { value: new THREE.Color(L.horizon) },
          sunGlow: { value: L.stars ? 0 : 1 },
          stars: { value: L.stars ? 1 : 0 },
        },
        vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `varying vec3 vDir; uniform vec3 sunDir; uniform vec3 top; uniform vec3 horizon; uniform float sunGlow; uniform float stars;
          float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
          void main(){
            float h = clamp(vDir.y, 0.0, 1.0);
            vec3 col = mix(horizon, top, pow(h, 0.55));
            float d = max(dot(normalize(vDir), sunDir), 0.0);
            col += sunGlow * vec3(1.0, 0.92, 0.78) * (pow(d, 220.0) * 2.0 + pow(d, 8.0) * 0.25);
            col += stars * step(0.9975, hash(floor(vDir * 420.0))) * smoothstep(0.08, 0.4, h) * 0.9;
            gl_FragColor = vec4(col, 1.0);
          }`,
      })
    )
  );
  if (L.clouds > 0.05) {
    const cloudTex = canvasTex(256, 128, (g, w, h) => {
      const r = rng(5);
      for (let i = 0; i < 22; i++) {
        const x = w * (0.2 + r() * 0.6);
        const y = h * (0.45 + r() * 0.25);
        const rad = 18 + r() * 34;
        const grd = g.createRadialGradient(x, y, 0, x, y, rad);
        grd.addColorStop(0, "rgba(255,255,255,0.85)");
        grd.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grd;
        g.fillRect(0, 0, w, h);
      }
    });
    const cr = rng(9);
    const tint = new THREE.Color(L.horizon).lerp(new THREE.Color("#ffffff"), 0.6);
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: tint, transparent: true, depthWrite: false, fog: false, opacity: L.clouds }));
      const a = cr() * Math.PI * 2;
      const d = 380 + cr() * 300;
      s.position.set(Math.sin(a) * d, 140 + cr() * 120, Math.cos(a) * d);
      s.scale.set(220 + cr() * 160, 90 + cr() * 50, 1);
      scene.add(s);
    }
  }

  // ---- land / sea around the stadium, so the horizon isn't empty ----
  const landCol = G.desert ? "#c8a96e" : G.countryCode === "UAE" ? "#c8a96e" : "#4d6b3a";
  const land = new THREE.Mesh(new THREE.RingGeometry(BOUNDARY + 14, 900, 64), new THREE.MeshStandardMaterial({ color: landCol, roughness: 1 }));
  land.rotation.x = -Math.PI / 2;
  land.position.y = -0.4;
  scene.add(land);
  if (G.sea) {
    const sea = new THREE.Mesh(new THREE.RingGeometry(260, 900, 64, 1, -0.9, 2.2), new THREE.MeshStandardMaterial({ color: L.stars ? "#0b2236" : "#2a6f97", roughness: 0.25, metalness: 0.2 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.2;
    scene.add(sea);
  }

  // ---- ground, pitch, circle, rope ----
  const ground = new THREE.Mesh(new THREE.CircleGeometry(BOUNDARY + 12, 96), new THREE.MeshStandardMaterial({ map: grassTex(quality.hi ? 2048 : 1024, G.grass, G.mowing), roughness: 0.92, normalMap: detailNormal("grass", 90), normalScale: new THREE.Vector2(0.55, 0.55) }));
  ground.material.map.anisotropy = 8;
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const apron = new THREE.Mesh(new THREE.RingGeometry(BOUNDARY + 12, BOUNDARY + 16, 96), new THREE.MeshStandardMaterial({ color: G.stands === "open" ? "#4a7d3a" : "#5b6270", roughness: 0.95 }));
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = 0.005;
  scene.add(apron);
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(3.05, 24), new THREE.MeshStandardMaterial({ map: pitchTex(G.pitch), roughness: 0.95, normalMap: detailNormal("soil", [3, 24]), normalScale: new THREE.Vector2(0.6, 0.6) }));
  pitch.material.map.anisotropy = 8;
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.y = 0.012;
  pitch.receiveShadow = true;
  scene.add(pitch);
  const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 0.1), new THREE.MeshBasicMaterial({ color: "#f5f5f5" }), 96);
  const d0 = new THREE.Object3D();
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    d0.position.set(Math.sin(a) * 27.4, 0.015, Math.cos(a) * 27.4);
    d0.rotation.set(-Math.PI / 2, 0, -a);
    d0.updateMatrix();
    dash.setMatrixAt(i, d0.matrix);
  }
  scene.add(dash);
  const rope = new THREE.Mesh(new THREE.TorusGeometry(BOUNDARY, 0.2, 8, 220), new THREE.MeshStandardMaterial({ color: "#e8ecf1", roughness: 0.6 }));
  rope.rotation.x = Math.PI / 2;
  rope.position.y = 0.16;
  rope.castShadow = true;
  scene.add(rope);

  // ---- LED advertising boards (they scroll): the ground's welcome + the usual ads ----
  const [, f1, f2, f3] = G.flag;
  const dark = (c) => new THREE.Color(c).lerp(new THREE.Color("#05070c"), 0.72).getStyle();
  const bright = (c) => (new THREE.Color(c).getHSL({ h: 0, s: 0, l: 0 }).l < 0.3 ? "#ffffff" : c);
  const boardTex = canvasTex(2048, 96, (g, w, h) => {
    const segs = [
      [`WELCOME TO ${G.name.toUpperCase()}`, dark(f1), bright(f2 === "#ffffff" ? f1 : f2)],
      [G.city.split(",")[0].toUpperCase(), "#101826", "#ffffff"],
      ["PLAYER INFO", "#0b1220", "#ffc81a"],
      [G.name.toUpperCase().slice(0, 22), dark(f3), bright(f3 === "#ffffff" ? f1 : f3)],
      ["NRV LEGENDS", "#2a1206", "#ff7a2e"],
      ["VPN LEGENDS", "#04202a", "#22d3ee"],
      [G.name.toUpperCase(), dark(f2), bright(f1)],
      ["#PLAYERINFO", "#1d0b24", "#f0abfc"],
    ];
    const sw = w / segs.length;
    segs.forEach(([txt, bg, fg], i) => {
      g.fillStyle = bg;
      g.fillRect(i * sw, 0, sw, h);
      g.fillStyle = fg;
      let px = 42;
      do g.font = `bold ${px}px Arial, sans-serif`;
      while (g.measureText(txt).width > sw - 16 && (px -= 2) > 14);
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(txt, i * sw + sw / 2, h / 2);
    });
  }, { repeat: [-4, 1] });
  const boards = new THREE.Mesh(new THREE.CylinderGeometry(BOUNDARY + 6, BOUNDARY + 6, 1.0, 128, 1, true), new THREE.MeshBasicMaterial({ map: boardTex, side: THREE.DoubleSide, toneMapped: false }));
  boards.position.y = 0.5;
  scene.add(boards);
  out.boardTex = boardTex;

  // ---- stands ----
  const concrete = new THREE.MeshStandardMaterial({ color: "#8b93a1", roughness: 0.9, side: THREE.DoubleSide });
  const seatsMat = new THREE.MeshStandardMaterial({ color: G.seats, roughness: 0.8, side: THREE.DoubleSide });
  const roofMat = new THREE.MeshStandardMaterial({ color: G.roof, roughness: 0.5, side: THREE.DoubleSide });
  const lowR = BOUNDARY + 11;
  const open = G.stands === "open";
  const bowl = G.stands === "bowl";
  const extra = G.big ? 6 : 0;
  const low = { r0: lowR, y0: 1.6, rows: open ? 7 : (quality.hi ? 16 : 12) + (G.big ? 3 : 0), tread: 0.85, rise: 0.42, arcs: open ? MAIN : FULL };
  const upR = low.r0 + low.rows * low.tread + 3;
  const up = { r0: upR, y0: low.y0 + low.rows * low.rise + 3.2, rows: (quality.hi ? 14 : 10) + extra, tread: 0.85, rise: 0.5, arcs: bowl ? FULL : MAIN };
  const tiers = open ? [low] : [low, up];
  for (const t of tiers) {
    for (const [s, l] of t.arcs) scene.add(new THREE.Mesh(new THREE.LatheGeometry(standProfile(t.r0, t.y0, t.rows, t.tread, t.rise), 96, s, l), seatsMat));
  }
  // grass banks (open grounds), with picnic spectators and trees
  const bankIn = open ? lowR : 0;
  if (open) {
    const bankPts = [new THREE.Vector2(bankIn - 1, 0), new THREE.Vector2(bankIn + 4, 0.6), new THREE.Vector2(bankIn + 14, 4.2), new THREE.Vector2(bankIn + 18, 4.6), new THREE.Vector2(bankIn + 30, -0.4)];
    const bank = new THREE.Mesh(new THREE.LatheGeometry(bankPts, 96), new THREE.MeshStandardMaterial({ color: new THREE.Color(G.grass[1]).offsetHSL(0, 0, -0.04), roughness: 1, side: THREE.DoubleSide }));
    bank.receiveShadow = true;
    scene.add(bank);
  }
  let roofY = 0;
  let screenR = lowR + 16;
  if (!open) {
    const ribbonTex = boardTex.clone();
    ribbonTex.repeat.set(-3, 1);
    ribbonTex.needsUpdate = true;
    for (const [s, l] of up.arcs) {
      const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(upR - 0.4, upR - 0.4, 1.4, 96, 1, true, s, l), new THREE.MeshBasicMaterial({ map: ribbonTex, side: THREE.DoubleSide, toneMapped: false }));
      ribbon.position.y = up.y0 - 0.9;
      scene.add(ribbon);
      const deck = new THREE.Mesh(new THREE.RingGeometry(low.r0 + low.rows * low.tread, upR, 96, 1, s - Math.PI / 2, l), concrete);
      deck.rotation.x = -Math.PI / 2;
      deck.position.y = up.y0 - 1.6;
      scene.add(deck);
    }
    out.ribbonTex = ribbonTex;
    roofY = up.y0 + up.rows * up.rise + 6;
    const roofInner = upR - 4;
    const roofArcs = bowl ? [[0, Math.PI * 2]] : [[Math.PI - 1.4, 2.8]];
    for (const [s, l] of roofArcs) {
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(roofInner, up.r0 + up.rows * up.tread + 2, 3.5, 128, 1, true, s, l), roofMat);
      roof.position.y = roofY;
      scene.add(roof);
      // torus arc t runs from a = pi/2 once laid flat; turn the holder so it starts at s
      const roofEdge = new THREE.Mesh(new THREE.TorusGeometry(roofInner, 0.35, 6, 128, l), new THREE.MeshStandardMaterial({ color: "#c9d1db", roughness: 0.4 }));
      roofEdge.rotation.x = -Math.PI / 2;
      const holder = new THREE.Group();
      holder.rotation.y = s - Math.PI / 2;
      holder.position.y = roofY + 1.75;
      holder.add(roofEdge);
      scene.add(holder);
    }
    const colGeo = new THREE.CylinderGeometry(0.35, 0.35, roofY - up.y0 + 4, 8);
    const colMat = new THREE.MeshStandardMaterial({ color: "#aab3bf", roughness: 0.6 });
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      if (!bowl && !inArcs(a, roofArcs)) continue;
      const col = new THREE.Mesh(colGeo, colMat);
      const rr = up.r0 + up.rows * up.tread;
      col.position.set(Math.sin(a) * rr, (roofY + up.y0 - 4) / 2, Math.cos(a) * rr);
      scene.add(col);
    }
    screenR = upR + 8;
  } else roofY = 12;

  // ---- spectators ----
  const seats = [];
  const r = rng(21);
  const spacing = quality.hi ? 0.75 : 0.95;
  for (const t of tiers) {
    for (let row = 0; row < t.rows; row++) {
      const rr = t.r0 + row * t.tread + t.tread * 0.55;
      const y = t.y0 + row * t.rise;
      const n = Math.floor((Math.PI * 2 * rr) / spacing);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (row % 2) * (spacing / rr / 2);
        if (!inArcs(a, t.arcs)) continue;
        if (r() > 0.86) continue;
        const x = Math.sin(a) * rr;
        const z = Math.cos(a) * rr;
        seats.push({ x, y, z, face: Math.atan2(-x, -z), side: x < 0 ? sides[0] : sides[1] });
      }
    }
  }
  if (open) {
    // fans sitting on the grass banks
    for (let i = 0; i < (quality.hi ? 2600 : 1600); i++) {
      const a = r() * Math.PI * 2;
      if (Math.abs(Math.sin(a)) < Math.sin(SIGHT_GAP + 0.03) || inArcs(a, MAIN)) continue;
      const d = bankIn + 3 + r() * 10;
      const y = 0.4 + ((d - bankIn - 4) / 10) * 3.6 - 0.35;
      const x = Math.sin(a) * d;
      const z = Math.cos(a) * d;
      seats.push({ x, y: Math.max(0.1, y), z, face: Math.atan2(-x, -z), side: x < 0 ? sides[0] : sides[1] });
    }
  }
  const crowd = makeCrowd(seats, G.crowd);
  crowd.meshes.forEach((m) => scene.add(m));
  out.crowd = crowd;

  for (const s of [-1, 1]) {
    const screen = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 0.6), new THREE.MeshStandardMaterial({ color: "#f2f4f6", roughness: 0.8 }));
    screen.position.set(0, 6, s * (lowR + 2));
    screen.castShadow = true;
    scene.add(screen);
  }

  // ---- big screen ----
  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = 1024;
  screenCanvas.height = 512;
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const bigScreen = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(24, 12), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  const frame = new THREE.Mesh(new THREE.BoxGeometry(25.5, 13.5, 1), new THREE.MeshStandardMaterial({ color: "#1f2633", roughness: 0.6 }));
  frame.position.z = -0.55;
  bigScreen.add(frame, panel);
  const sa = Math.PI * 0.78;
  bigScreen.position.set(Math.sin(sa) * screenR, roofY + 10, Math.cos(sa) * screenR);
  bigScreen.lookAt(0, roofY - 4, 0);
  scene.add(bigScreen);
  if (open) {
    const legs = new THREE.Mesh(new THREE.BoxGeometry(1.2, roofY + 4, 1.2), new THREE.MeshStandardMaterial({ color: "#374151" }));
    legs.position.set(bigScreen.position.x, (roofY + 4) / 2, bigScreen.position.z);
    scene.add(legs);
  }
  out.screen = { canvas: screenCanvas, tex: screenTex };

  // ---- floodlight masts (glowing under lights) ----
  if (!open || L.lamps) {
    const mastMat = new THREE.MeshStandardMaterial({ color: "#9aa3ad", roughness: 0.5, metalness: 0.4 });
    const lampMat = new THREE.MeshBasicMaterial({ color: L.lamps ? "#ffffff" : "#fffbe8", toneMapped: false });
    const flare = L.lamps
      ? canvasTex(128, 128, (g) => {
          const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
          rg.addColorStop(0, "rgba(255,255,255,1)");
          rg.addColorStop(0.2, "rgba(255,250,230,0.55)");
          rg.addColorStop(1, "rgba(255,240,200,0)");
          g.fillStyle = rg;
          g.fillRect(0, 0, 128, 128);
        })
      : null;
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const rr = (open ? lowR + 22 : upR) + 26;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.4, 62, 10), mastMat);
      mast.position.set(Math.sin(a) * rr, 31, Math.cos(a) * rr);
      const head = new THREE.Group();
      head.add(new THREE.Mesh(new THREE.BoxGeometry(14, 7, 0.8), mastMat));
      for (let k = 0; k < 24; k++) {
        const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.55, 10), lampMat);
        lamp.position.set(-5.6 + (k % 6) * 2.25, -2.2 + Math.floor(k / 6) * 1.5, 0.45);
        head.add(lamp);
      }
      head.position.set(Math.sin(a) * rr, 63, Math.cos(a) * rr);
      head.lookAt(0, 0, 0);
      if (flare) {
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: flare, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, opacity: L.stars ? 1 : 0.6 }));
        glow.scale.setScalar(L.stars ? 46 : 30);
        glow.position.set(0, 0, 2);
        head.add(glow);
      }
      scene.add(mast, head);
    }
  }

  // ---- dugout where batters walk off to ----
  const dug = new THREE.Group();
  const roofD = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 3.2), new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.5 }));
  roofD.position.y = 2.6;
  const backD = new THREE.Mesh(new THREE.BoxGeometry(10, 2.6, 0.2), new THREE.MeshStandardMaterial({ color: "#334155" }));
  backD.position.set(0, 1.3, -1.5);
  const bench = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: "#64748b" }));
  bench.position.set(0, 0.25, -1);
  dug.add(roofD, backD, bench);
  const pa = Math.atan2(-34, -40);
  dug.position.set(Math.sin(pa) * (BOUNDARY + 9), 0, Math.cos(pa) * (BOUNDARY + 9));
  dug.lookAt(0, 0, 0);
  scene.add(dug);

  addLandmarks(scene, G, L, { lowR, outer: open ? lowR + 32 : upR + up.rows * up.tread + 6, r: r0 });
  return out;
}

// Things around the ground that make it recognisable: a pavilion, trees, a skyline, mountains, a fort…
function addLandmarks(scene, G, L, { lowR, outer, r }) {
  const night = L.stars;
  const add = (geo, color, pos, opt = {}) => {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: opt.rough ?? 0.85, emissive: opt.emissive || "#000000", emissiveIntensity: opt.ei ?? 1, emissiveMap: opt.emap || null, map: opt.map || null, flatShading: !!opt.flat }));
    m.position.set(...pos);
    if (opt.rot) m.rotation.set(...opt.rot);
    if (opt.shadow) m.castShadow = true;
    scene.add(m);
    return m;
  };
  const polar = (a, d, y = 0) => [Math.sin(a) * d, y, Math.cos(a) * d];

  // the members' pavilion, behind the bowler's end (in view of the broadcast camera)
  if (G.pavilion) {
    const a = Math.PI + 0.55;
    const d = lowR + (G.stands === "open" ? 18 : 10);
    const grp = new THREE.Group();
    const brick = new THREE.MeshStandardMaterial({ color: "#a0522d", roughness: 0.85 });
    const stone = new THREE.MeshStandardMaterial({ color: "#efe6d2", roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(34, 14, 10), brick);
    body.position.y = 7;
    const balcony = new THREE.Mesh(new THREE.BoxGeometry(34.5, 0.6, 3), stone);
    balcony.position.set(0, 6, 5.5);
    const roofP = new THREE.Mesh(new THREE.BoxGeometry(35, 1.2, 11), stone);
    roofP.position.y = 14.5;
    grp.add(body, balcony, roofP);
    for (const x of [-14, 14]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(5, 22, 5), brick);
      tower.position.set(x, 11, 0);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(3.8, 5, 4), new THREE.MeshStandardMaterial({ color: "#3f6b4f", roughness: 0.6 }));
      cap.position.set(x, 24.5, 0);
      cap.rotation.y = Math.PI / 4;
      grp.add(tower, cap);
    }
    for (let i = 0; i < 9; i++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2, 3), new THREE.MeshStandardMaterial({ color: "#1f2937", emissive: night ? "#ffd58a" : "#000000", emissiveIntensity: 0.8 }));
      win.position.set(-12 + i * 3, 10, 5.01);
      grp.add(win);
    }
    grp.position.set(...polar(a, d));
    grp.lookAt(0, 0, 0);
    scene.add(grp);
  }

  // trees around open grounds / behind the stands
  if (G.trees) {
    const n = 90;
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 5, 6);
    const crownGeo = new THREE.IcosahedronGeometry(3.6, 1);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: "#5b3a24", roughness: 1 }), n);
    const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, flatShading: true }), n);
    const o = new THREE.Object3D();
    const leaf = new THREE.Color();
    const palms = ["SL", "WI", "IND"].includes(G.countryCode);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = outer + 4 + r() * 40;
      const s = 0.8 + r() * 0.9;
      o.position.set(Math.sin(a) * d, 2.5 * s, Math.cos(a) * d);
      o.scale.set(s, s * (palms ? 2.2 : 1), s);
      o.rotation.set(0, r() * 6, 0);
      o.updateMatrix();
      trunks.setMatrixAt(i, o.matrix);
      o.position.y = (palms ? 11 : 7) * s;
      o.scale.set(s * (palms ? 1.3 : 1), s * (palms ? 0.45 : 1), s * (palms ? 1.3 : 1));
      o.updateMatrix();
      crowns.setMatrixAt(i, o.matrix);
      leaf.set(["#2f6b2f", "#3b7a35", "#4a8a3a", "#2c5f2c"][i % 4]).offsetHSL(0, 0, (r() - 0.5) * 0.08);
      crowns.setColorAt(i, leaf);
    }
    scene.add(trunks, crowns);
  }

  // a city skyline (lit windows at night)
  if (G.skyline) {
    const winTex = canvasTex(64, 128, (g, w, h) => {
      g.fillStyle = "#000";
      g.fillRect(0, 0, w, h);
      const rr = rng(4);
      for (let y = 4; y < h; y += 8) for (let x = 4; x < w; x += 8) if (rr() < 0.55) (g.fillStyle = `rgba(255,${200 + rr() * 50},140,${0.6 + rr() * 0.4})`), g.fillRect(x, y, 4, 5);
    });
    winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
    for (let i = 0; i < 60; i++) {
      const a = Math.PI + (r() - 0.5) * 3.4;
      const d = 260 + r() * 260;
      const hgt = 25 + r() * (G.countryCode === "UAE" ? 160 : 90);
      const wd = 14 + r() * 20;
      const tex = winTex.clone();
      tex.repeat.set(wd / 10, hgt / 20);
      tex.needsUpdate = true;
      const b = add(new THREE.BoxGeometry(wd, hgt, wd), ["#8a94a6", "#a7b1c2", "#6b7385", "#c3c9d4"][i % 4], polar(a, d, hgt / 2), { emissive: night ? "#ffffff" : "#000000", emap: night ? tex : null, ei: night ? 0.9 : 0 });
      b.lookAt(0, hgt / 2, 0);
    }
  }

  // mountains: a table mountain, snowy peaks, or green / brown hills
  if (G.mountains) {
    const col = { table: "#5d6658", snow: "#5f6f7c", green: "#3e6b45", brown: "#8a7255" }[G.mountains];
    const tone = new THREE.Color(col).lerp(new THREE.Color(L.horizon), night ? 0.65 : 0.35);
    if (G.mountains === "table") {
      const m = add(new THREE.CylinderGeometry(150, 230, 110, 9, 1), tone, [-140, 50, -560], { flat: true });
      m.scale.set(2.2, 1, 0.6);
      add(new THREE.ConeGeometry(110, 150, 7), tone.clone().offsetHSL(0, 0, -0.03), [260, 70, -520], { flat: true });
    } else {
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i - 4) * 0.32 + (r() - 0.5) * 0.15;
        const hgt = (G.mountains === "snow" ? 220 : 120) + r() * 110;
        const pk = add(new THREE.ConeGeometry(120 + r() * 80, hgt, 7), tone.clone().offsetHSL(0, 0, (r() - 0.5) * 0.06), polar(a, 560 + r() * 140, hgt / 2 - 10), { flat: true });
        if (G.mountains === "snow") {
          const capH = hgt * 0.32;
          const cap = add(new THREE.ConeGeometry((120 + 40) * 0.36, capH, 7), new THREE.Color("#f4f7fb").lerp(new THREE.Color(L.horizon), 0.3), [pk.position.x, hgt - 10 - capH / 2 + 2, pk.position.z], { flat: true });
          cap.scale.copy(pk.scale);
        }
      }
    }
  }

  // Galle: the old fort ramparts by the sea
  if (G.fort) {
    const stone = "#b8a27a";
    const a0 = -0.45;
    for (let i = 0; i < 14; i++) {
      const a = a0 + i * 0.07;
      const d = outer + 30;
      const wall = add(new THREE.BoxGeometry(14, 7, 4), stone, polar(a, d, 3.5), { rough: 0.95 });
      wall.lookAt(0, 3.5, 0);
      if (i % 4 === 0) add(new THREE.CylinderGeometry(4, 4.5, 10, 10), stone, polar(a, d + 2, 5));
    }
    const tower = add(new THREE.BoxGeometry(5, 26, 5), "#f1ece0", polar(a0 + 0.5, outer + 40, 13));
    tower.lookAt(0, 13, 0);
  }

  // Malahide castle
  if (G.castle) {
    const grey = "#9a9688";
    const pos = polar(Math.PI - 0.7, outer + 60);
    add(new THREE.BoxGeometry(30, 16, 18), grey, [pos[0], 8, pos[2]]);
    for (const [dx, dz] of [[-15, -9], [15, -9], [-15, 9], [15, 9]]) add(new THREE.CylinderGeometry(3.5, 3.5, 22, 12), grey, [pos[0] + dx, 11, pos[2] + dz]);
  }

  // The Oval's gasholder frame
  if (G.gasholder) {
    const pos = polar(Math.PI + 0.9, outer + 70);
    const g = new THREE.Mesh(new THREE.CylinderGeometry(32, 32, 52, 24, 4, true), new THREE.MeshStandardMaterial({ color: "#5f6b7a", wireframe: true }));
    g.position.set(pos[0], 26, pos[2]);
    scene.add(g);
  }
}

// ---------- stumps ----------
function makeStumps(z) {
  const group = new THREE.Group();
  group.position.set(0, 0, z);
  const wood = new THREE.MeshStandardMaterial({ color: "#efe0bd", roughness: 0.55 });
  const X = [-0.115, 0, 0.115];
  const stumps = X.map((x) => {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.71, 10), wood);
    m.position.y = 0.355;
    m.castShadow = true;
    pivot.add(m);
    pivot.position.x = x;
    group.add(pivot);
    return pivot;
  });
  const bails = [-0.058, 0.058].map((x) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.112, 8), wood);
    b.rotation.z = Math.PI / 2;
    b.position.set(x, 0.72, 0);
    b.castShadow = true;
    group.add(b);
    return b;
  });
  // tb < 0: intact. tb >= 0: seconds since broken. dir 1 = knocked towards -z.
  const pose = (tb, dir = 1, wild = 1) => {
    stumps.forEach((s, i) => {
      s.position.set(X[i], 0, 0);
      s.rotation.set(0, 0, 0);
    });
    bails.forEach((b, i) => {
      b.position.set([-0.058, 0.058][i], 0.72, 0);
      b.rotation.set(0, 0, Math.PI / 2);
    });
    if (tb < 0) return;
    const k = Math.min(tb * 6, 1);
    stumps.forEach((s, i) => {
      s.rotation.x = -dir * k * [0.35, 0.9, 0.55][i] * wild;
      s.rotation.z = (i - 1) * 0.3 * k * wild;
    });
    if (wild > 1.2) {
      const f = Math.min(tb, 0.95);
      stumps[1].position.set(0.15 * f, Math.max(0, 2.6 * f - 4.9 * f * f), -dir * 3.4 * f);
      stumps[1].rotation.x = -dir * tb * 10;
    }
    bails.forEach((b, i) => {
      const t = Math.min(tb, 1.2);
      b.position.set((i ? 1 : -1) * (0.35 + 1.3 * t), Math.max(0.012, 0.72 + 3.4 * t - 4.9 * t * t), -dir * (0.5 + 1.8 * t));
      b.rotation.set(tb * 14 * (i ? 1 : -1), tb * 8, tb * 11);
    });
  };
  return { group, pose };
}

// ---------- the duck (for ducks) ----------
function makeDuck() {
  const g = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: "#ffd23f", roughness: 0.6 });
  const orange = new THREE.MeshStandardMaterial({ color: "#ff8a1f", roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 14), yellow);
  body.scale.set(1, 0.8, 1.25);
  body.position.y = 0.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), yellow);
  head.position.set(0, 1.05, 0.38);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 10), orange);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 1.0, 0.7);
  const eyeM = new THREE.MeshStandardMaterial({ color: "#111", roughness: 0.2 });
  const eyes = [0.12, -0.12].map((x) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeM);
    e.position.set(x, 1.12, 0.6);
    return e;
  });
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 8), yellow);
  tail.rotation.x = -Math.PI / 2.6;
  tail.position.set(0, 0.7, -0.58);
  const feet = [0.15, -0.15].map((x) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.24), orange);
    f.position.set(x, 0.03, 0.1);
    return f;
  });
  g.add(body, head, beak, ...eyes, tail, ...feet);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  g.scale.setScalar(1.3);
  return { group: g, feet };
}

// ---------- confetti ----------
function makeConfetti(n = 320) {
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.12), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), n);
  const palette = ["#ff7a2e", "#ffc81a", "#22d3ee", "#3b82f6", "#c6f45b", "#ff4f8b", "#ffffff"].map((c) => new THREE.Color(c));
  const r = rng(4);
  const seeds = Array.from({ length: n }, () => ({ x: (r() - 0.5) * 30, z: (r() - 0.5) * 30, y: 12 + r() * 14, s: 0.6 + r(), r: r() * 6 }));
  seeds.forEach((_, i) => mesh.setColorAt(i, palette[i % palette.length]));
  const d = new THREE.Object3D();
  const pose = (t, cx = 0, cz = 0) => {
    mesh.visible = t >= 0;
    if (t < 0) return;
    seeds.forEach((s, i) => {
      const y = s.y - ((t * 2.6 * s.s) % (s.y + 2));
      d.position.set(cx + s.x + Math.sin(t * 2 + s.r) * 1.2, Math.max(0.03, y), cz + s.z + Math.cos(t * 1.7 + s.r) * 1.2);
      d.rotation.set(t * 4 * s.s + s.r, t * 3 + s.r, t * 2);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  mesh.frustumCulled = false;
  return { mesh, pose };
}

// ---------- fielding positions (right-hander) ----------
export const FIELD = [
  { id: "keeper", x: 0, z: -13.4 },
  { id: "slip", x: -1.9, z: -14.6 },
  { id: "point", x: -24, z: -9 },
  { id: "cover", x: -26, z: 6 },
  { id: "midoff", x: -11, z: 25 },
  { id: "midon", x: 11, z: 25 },
  { id: "midwicket", x: 26, z: 3 },
  { id: "squareleg", x: 26, z: -12 },
  { id: "fineleg", x: 34, z: -46 },
  { id: "thirdman", x: -34, z: -46 },
];

// ground: a ground id or object from grounds.js; light: "day" | "dusk" | "night" (default: the ground's)
export function createWorld(canvas, { sides = ["nrv", "vpn"], ground, light, quality: qualityLevel = "auto" } = {}) {
  const G = (typeof ground === "object" && ground) || findGround(ground) || findGround(DEFAULT_GROUND);
  const L = LIGHTS[light] || LIGHTS[G.light] || LIGHTS.day;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const quality = { hi: !small, shadow: qualityLevel === "ultra" ? 4096 : small || qualityLevel === "performance" ? 1024 : 2048 };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: qualityLevel === "performance", powerPreference: "high-performance", stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = L.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(L.fog, 260, 900);
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 2000);
  // soft studio reflections for every PBR material (helmets, shoes, skin, kit sheen)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = envTex;
  scene.environmentIntensity = L.stars ? 0.25 : 0.4;

  scene.add(new THREE.HemisphereLight(...L.hemi));
  const sun = new THREE.DirectionalLight(L.sun, L.sunI);
  sun.position.set(...L.sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadow, quality.shadow);
  Object.assign(sun.shadow.camera, { left: -72, right: 72, top: 72, bottom: -72, near: 10, far: 220 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const sunDir = v3(...L.sunPos).normalize();
  let shadowHalf = 72;
  // shadows follow the action: a tight, sharp shadow map on close-ups, the whole field on wide shots
  const fitShadows = () => {
    const dist = camera.position.distanceTo(camLook);
    const half = Math.min(72, Math.max(9, dist * 0.75 + 4));
    const c = half < 60 ? camLook : v3(0, 0, 0);
    sun.target.position.set(c.x, 0, c.z);
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 110);
    if (Math.abs(half - shadowHalf) > 0.5) {
      shadowHalf = half;
      Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 10, far: 240 });
      sun.shadow.camera.updateProjectionMatrix();
    }
  };

  const stadium = buildStadium(scene, quality, sides, G, L);
  const pipe = createPipeline(renderer, scene, camera, { quality: qualityLevel, small });
  let lastFrame = 0;
  if (L.lamps) {
    // floodlights: extra soft light from the other towers
    for (const [x, z] of [[-60, -60], [60, -60], [-60, 60]]) {
      const fl = new THREE.DirectionalLight("#f4f7ff", L.stars ? 0.55 : 0.3);
      fl.position.set(x, 70, z);
      scene.add(fl);
    }
  }

  const stumps = { bat: makeStumps(STRIKER_Z), bowl: makeStumps(BOWLER_Z) };
  scene.add(stumps.bat.group, stumps.bowl.group);

  const striker = new Player({ role: "batter", seed: 1 });
  const nonStriker = new Player({ role: "batter", seed: 2 });
  const bowler = new Player({ role: "fielder", seed: 3 });
  const umpire = new Player({ role: "umpire", seed: 4 });
  const fielders = FIELD.map((f, i) => new Player({ role: f.id === "keeper" ? "keeper" : "fielder", seed: i + 5 }));
  [striker, nonStriker, bowler, umpire, ...fielders].forEach((p) => scene.add(p.root));

  // ball: leather + seam, with a soft glow so it reads at broadcast distances
  const ball = new THREE.Group();
  const leather = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), new THREE.MeshStandardMaterial({ color: "#b3122a", roughness: 0.35 }));
  leather.castShadow = true;
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.004, 4, 24), new THREE.MeshStandardMaterial({ color: "#f3f0e6" }));
  ball.add(leather, seam);
  ball.scale.setScalar(2.2);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: canvasTex(64, 64, (g) => {
        const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        rg.addColorStop(0, "rgba(255,250,225,0.9)");
        rg.addColorStop(0.35, "rgba(255,235,170,0.35)");
        rg.addColorStop(1, "rgba(255,220,140,0)");
        g.fillStyle = rg;
        g.fillRect(0, 0, 64, 64);
      }),
      transparent: true,
      depthWrite: false,
    })
  );
  glow.scale.setScalar(0.2); // small: the bloom pass already makes it glow
  glow.material.opacity = 0.6;
  ball.add(glow);
  scene.add(ball);
  const TRAIL = 30;
  const trailPos = new Float32Array(TRAIL * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: "#fff6cf", transparent: true, opacity: 0.55 }));
  trail.frustumCulled = false;
  scene.add(trail);
  let trailPts = [];

  const hawk = { group: new THREE.Group(), key: "" };
  hawk.group.visible = false;
  scene.add(hawk.group);

  const duck = makeDuck();
  scene.add(duck.group);
  const confetti = makeConfetti();
  scene.add(confetti.mesh);

  const camPos = v3(0, 7, 34);
  const camLook = v3(0, 1, -8);
  let camShot = "";
  let excite = 0;
  let screenKey = "";

  const drawScreen = (lines) => {
    const key = JSON.stringify(lines);
    if (key === screenKey) return;
    screenKey = key;
    const { canvas: c, tex } = stadium.screen;
    const g = c.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 0, c.height);
    grd.addColorStop(0, "#0b1530");
    grd.addColorStop(1, "#050a18");
    g.fillStyle = grd;
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#c8102e";
    g.fillRect(0, 0, c.width, 70);
    g.fillStyle = "#fff";
    g.font = "bold 44px Arial, sans-serif";
    g.textBaseline = "middle";
    g.textAlign = "center";
    g.fillText(lines.top || "PLAYER INFO", c.width / 2, 36);
    g.font = "bold 120px Arial, sans-serif";
    g.fillStyle = lines.color || "#ffd23f";
    g.fillText(lines.big || "", c.width / 2, 230);
    g.font = "bold 52px Arial, sans-serif";
    g.fillStyle = "#e5ecff";
    g.fillText(lines.small || "", c.width / 2, 400);
    tex.needsUpdate = true;
  };
  drawScreen({ top: G.name.toUpperCase(), big: "WELCOME", small: G.city });

  let defaults = null;
  let library = {};
  let lastTeams = null;
  const api = {
    scene,
    camera,
    ground: G,
    light: L,
    renderer,
    striker,
    nonStriker,
    bowler,
    umpire,
    fielders,
    keeper: fielders[0],
    stumps,
    duck,
    confetti,
    // kits + names on shirts: batC / fieldC = { shirt, trousers, trim }
    // roster (optional): squad players { name, jersey, look } for striker / nonStriker / bowler and
    // fielders[0..9] (fielders[0] keeps wicket). Names, shirt numbers and looks come from them.
    setTeams(batC, fieldC, names = {}, roster = {}) {
      lastTeams = [batC, fieldC, names, roster];
      let k = 0;
      const dress = (p, kitC, who, fallbackName, fallbackNo) => {
        const name = who?.look?.shirtName || who?.name || fallbackName || "";
        const jersey = who?.jersey;
        p.setKit({ ...kitC, number: jersey !== undefined && jersey !== "" ? jersey : fallbackNo, name });
        p.setLook(lookFor(who || { name: name || `${kitC.code || ""}-${fallbackNo}` }));
        // 3D model: the player's own, else the default for everyone, else the code-built body
        const id = who?.look?.model;
        const fallback = defaults?.players?.length ? defaults.players[k % defaults.players.length] : null;
        k++;
        p.setModel(id === "builtin" ? null : (id && library[id]) || fallback);
      };
      dress(striker, batC, roster.striker, names.striker, names.strikerNo ?? 7);
      dress(nonStriker, batC, roster.nonStriker, names.nonStriker, names.nonStrikerNo ?? 18);
      dress(bowler, fieldC, roster.bowler, names.bowler, names.bowlerNo ?? 9);
      fielders.forEach((f, i) => dress(f, fieldC, (roster.fielders || [])[i], (names.fielders || [])[i], [1, 33, 45, 10, 23, 64, 3, 77, 11, 28][i]));
      // the umpire's look (and shirt / trousers colours) is set on the match setup screen
      const uL = lookFor({ name: "umpire", look: roster.umpireLook || {} });
      umpire.setKit({ shirt: uL.umpireShirt, trousers: uL.umpireTrousers, trim: "#1f2937" });
      umpire.setLook(uL);
      umpire.setModel(defaults?.umpire || defaults?.players?.[0] || null);
    },
    // { id: template } for players who picked their own model (look.model)
    useModelLibrary(map) {
      library = map || {};
      if (lastTeams) api.setTeams(...lastTeams);
    },
    // Hawk-Eye: { key, path: [Vector3…], pitch, impact, stumps, progress 0..1 } or null
    setHawkEye(h) {
      if (!h) {
        hawk.group.visible = false;
        return;
      }
      if (h.key !== hawk.key) {
        hawk.key = h.key;
        hawk.group.clear();
        const tube = (pts, color, opacity) => {
          const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, 0.036, 10);
          const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, toneMapped: false }));
          hawk.group.add(m);
          return m;
        };
        hawk.real = tube(h.path, "#ff3d3d", 0.92);
        hawk.proj = tube([h.impact, h.impact.clone().lerp(h.stumps, 0.5), h.stumps], "#3da5ff", 0.85);
        const ring = (p, color, r = 0.13) => {
          const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.6, r, 32), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.95, toneMapped: false }));
          m.position.copy(p);
          hawk.group.add(m);
          return m;
        };
        hawk.pitchMark = ring(v3(h.pitch.x, 0.02, h.pitch.z), "#2ee66b");
        hawk.pitchMark.rotation.x = -Math.PI / 2;
        hawk.impactMark = ring(h.impact, "#ffd23f", 0.09);
        // the wicket zone: stumps + bails, in red when the ball goes on to hit them
        hawk.zone = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.72, 0.05), new THREE.MeshBasicMaterial({ color: "#ff3d3d", transparent: true, opacity: 0.35, toneMapped: false }));
        hawk.zone.position.set(0, 0.36, -10);
        hawk.group.add(hawk.zone);
        // a darker strip on the pitch: the "in line" zone between the stumps
        hawk.line = new THREE.Mesh(new THREE.PlaneGeometry(0.23, 20.1), new THREE.MeshBasicMaterial({ color: "#1d4ed8", transparent: true, opacity: 0.28, toneMapped: false }));
        hawk.line.rotation.x = -Math.PI / 2;
        hawk.line.position.set(0, 0.016, 0);
        hawk.group.add(hawk.line);
      }
      hawk.group.visible = true;
      const p = Math.max(0, Math.min(1, h.progress || 0));
      const draw = (mesh, k) => {
        const n = mesh.geometry.index.count;
        mesh.geometry.setDrawRange(0, Math.floor((n * Math.max(0, Math.min(1, k))) / 6) * 6);
      };
      draw(hawk.real, p / 0.7);
      draw(hawk.proj, (p - 0.7) / 0.3);
      hawk.pitchMark.visible = p > 0.45;
      hawk.impactMark.visible = p > 0.68;
      hawk.zone.visible = p > 0.95;
    },
    // real rigged characters (models.js): { players: [template…], umpire }
    useModels(set) {
      defaults = set?.players?.length ? set : null;
      if (lastTeams) api.setTeams(...lastTeams);
    },
    setScreen: drawScreen,
    setExcite(v) {
      excite = v;
    },
    // trail=false: the ball is being held (no flight trail)
    setBall(p, trail = true) {
      ball.visible = !!p;
      if (!p || !trail) {
        trailPts = [];
        if (p) ball.position.copy(p);
        return;
      }
      const last = trailPts[trailPts.length - 1];
      if (last && last.distanceTo(p) > 12) trailPts = [];
      ball.position.copy(p);
      ball.rotation.x += 0.4;
      trailPts.push(p.clone());
      if (trailPts.length > TRAIL) trailPts.shift();
    },
    clearTrail() {
      trailPts = [];
    },
    // shot: { id, pos, look, fov?, ease? } — snaps on a new id, eases otherwise
    setCamera(shot, dt) {
      const k = shot.id !== camShot ? 1 : 1 - Math.exp(-dt * (shot.ease || 5));
      camShot = shot.id;
      camPos.lerp(shot.pos, k);
      camLook.lerp(shot.look, k);
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      const fov = shot.fov || 40;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = k === 1 ? fov : lerp(camera.fov, fov, k);
        camera.updateProjectionMatrix();
      }
    },
    resize(w, h) {
      pipe.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
    setQuality(q) {
      pipe.setQuality(q);
    },
    get fps() {
      return pipe.fps;
    },
    get qualityInfo() {
      return pipe.info;
    },
    render(time = 0) {
      const u = stadium.crowd.uniforms;
      u.uTime.value = time;
      u.uExcite.value += (excite - u.uExcite.value) * 0.08;
      stadium.boardTex.offset.x = (time * 0.02) % 1;
      if (stadium.ribbonTex) stadium.ribbonTex.offset.x = (-time * 0.015) % 1;
      const n = trailPts.length;
      for (let i = 0; i < TRAIL; i++) {
        const p = trailPts[Math.max(0, n - TRAIL + i)] || trailPts[0];
        if (p) trailPos.set([p.x, p.y, p.z], i * 3);
      }
      trailGeo.attributes.position.needsUpdate = true;
      trail.visible = ball.visible && n > 2;
      fitShadows();
      // depth of field on tight close-ups (ultra quality)
      pipe.setFocus(camera.fov <= 32 && camera.position.distanceTo(camLook) < 9, camera.position.distanceTo(camLook));
      const dt = lastFrame ? Math.min(0.25, time - lastFrame) : 1 / 60;
      lastFrame = time;
      pipe.render(dt, time);
    },
    dispose() {
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        ms.forEach((m) => {
          m.map?.dispose?.();
          m.dispose?.();
        });
      });
      envTex.dispose();
      pipe.dispose();
      renderer.dispose();
    },
  };
  return api;
}
