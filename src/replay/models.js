// Real character models for the 3D highlights.
//
// Drop a rigged humanoid (Mixamo, Ready Player Me-style, Unreal Mannequin naming…) into
// public/models/ as cricketer.glb (or cricketer.fbx), optionally with public/models/models.json:
//   { "players": ["batsman.glb", "allrounder.fbx"], "umpire": "umpire.glb" }
// Each model is measured once ("calibrated"): turned to face +z, scaled to the match the rig's hip
// height, arms lowered from the T-pose. Every Player then clones it and drives its bones from the
// procedural rig in player.js, so all the clips, IK and bat-holding keep working unchanged.
import * as THREE from "three";

// rig joint → candidate bone names (lower-case, prefixes like "mixamorig:" / "Armature_" removed)
export const BONE_NAMES = {
  pelvis: ["hips", "pelvis", "hip"],
  spine: ["spine", "spine01", "spine1"],
  chest: ["spine2", "spine03", "upperchest", "chest", "spine02", "spine1"],
  neck: ["neck", "neck01"],
  head: ["head"],
  shL: ["leftarm", "upperarml", "leftupperarm", "lupperarm"],
  elL: ["leftforearm", "lowerarml", "leftlowerarm", "lforearm"],
  haL: ["lefthand", "handl", "lhand"],
  shR: ["rightarm", "upperarmr", "rightupperarm", "rupperarm"],
  elR: ["rightforearm", "lowerarmr", "rightlowerarm", "rforearm"],
  haR: ["righthand", "handr", "rhand"],
  thL: ["leftupleg", "thighl", "leftupperleg", "lthigh"],
  knL: ["leftleg", "calfl", "leftlowerleg", "lcalf"],
  anL: ["leftfoot", "footl", "lfoot"],
  thR: ["rightupleg", "thighr", "rightupperleg", "rthigh"],
  knR: ["rightleg", "calfr", "rightlowerleg", "rcalf"],
  anR: ["rightfoot", "footr", "rfoot"],
};
// parents before children, so world rotations can be set top-down
export const DRIVE_ORDER = ["pelvis", "spine", "chest", "neck", "head", "shL", "elL", "haL", "shR", "elR", "haR", "thL", "knL", "anL", "thR", "knR", "anR"];

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/^.*[:|]/, "")
    .replace(/^(mixamorig\d*|armature|bip0?1|def|cc_base)[_\s.-]*/, "")
    .replace(/[^a-z0-9]/g, "");

export function findBones(root) {
  const byName = new Map();
  root.traverse((o) => {
    if (o.isBone || o.type === "Bone") {
      const k = norm(o.name);
      if (!byName.has(k)) byName.set(k, o);
    }
  });
  const out = {};
  const used = new Set();
  for (const [key, names] of Object.entries(BONE_NAMES)) {
    for (const n of names) {
      const b = byName.get(n);
      // "spine1" is the spine for some rigs and the chest for others: never use one bone twice
      if (b && !used.has(b)) {
        out[key] = b;
        used.add(b);
        break;
      }
    }
  }
  return out;
}

const REQUIRED = ["pelvis", "spine", "head", "shL", "elL", "haL", "shR", "elR", "haR", "thL", "knL", "anL", "thR", "knR", "anR"];
const DOWN = new THREE.Vector3(0, -1, 0);
const wpos = (o) => o.getWorldPosition(new THREE.Vector3());

// Rotate `bone` in world space so the direction bone → child points along `dir`.
function aimBone(bone, child, dir) {
  bone.updateWorldMatrix(true, true);
  const cur = wpos(child).sub(wpos(bone));
  if (cur.lengthSq() < 1e-10) return;
  const q = new THREE.Quaternion().setFromUnitVectors(cur.normalize(), dir);
  const world = bone.getWorldQuaternion(new THREE.Quaternion());
  const parent = bone.parent ? bone.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
  bone.quaternion.copy(parent.invert().multiply(q.multiply(world)));
  bone.updateWorldMatrix(false, true);
}

// Turn a loaded scene into a calibrated template. Returns null if the rig isn't humanoid enough.
export function calibrate(scene, { name = "model" } = {}) {
  scene.updateMatrixWorld(true);
  let bones = findBones(scene);
  if (!bones.chest) bones.chest = bones.spine;
  const missing = REQUIRED.filter((k) => !bones[k]);
  if (missing.length) {
    console.warn(`[3D] ${name}: not a humanoid rig we understand (missing ${missing.join(", ")})`);
    return null;
  }
  // the scene is wrapped so we can turn / scale / lift it without touching the file's own transforms
  const turn = new THREE.Group();
  turn.add(scene);
  // face +z: the character's left arm must be on +x
  turn.updateMatrixWorld(true);
  const across = wpos(bones.shL).sub(wpos(bones.shR));
  turn.rotation.y = -Math.atan2(-across.z, across.x);
  turn.updateMatrixWorld(true);

  // arms down from the T / A pose, legs straight
  const sides = ["L", "R"];
  for (const s of sides) {
    aimBone(bones["sh" + s], bones["el" + s], DOWN);
    aimBone(bones["el" + s], bones["ha" + s], DOWN);
    aimBone(bones["th" + s], bones["kn" + s], DOWN);
    aimBone(bones["kn" + s], bones["an" + s], DOWN);
  }
  turn.updateMatrixWorld(true);

  // feet on the ground, hips at the rig's standing height
  const box = new THREE.Box3();
  scene.traverse((o) => {
    if (o.isMesh) {
      o.geometry.computeBoundingBox?.();
      if (o.isSkinnedMesh) {
        o.skeleton?.update();
        o.computeBoundingBox?.();
        if (o.boundingBox) box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));
      } else if (o.geometry.boundingBox) box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
    }
  });
  const ground = Number.isFinite(box.min.y) ? box.min.y : Math.min(wpos(bones.anL).y, wpos(bones.anR).y) - 0.08;
  const hipH = wpos(bones.pelvis).y - ground;
  if (!(hipH > 1e-4)) return null;
  const wrapper = new THREE.Group();
  wrapper.name = `model:${name}`;
  wrapper.add(turn);
  turn.position.y = -ground;
  wrapper.scale.setScalar(0.97 / hipH);
  wrapper.updateMatrixWorld(true);

  // rest pose in rig space (rig rest = every joint unrotated, so these are the bone offsets)
  const rest = {};
  for (const k of Object.keys(bones)) {
    rest[k] = { pos: wrapper.worldToLocal(wpos(bones[k])).multiply(wrapper.scale), q: bones[k].getWorldQuaternion(new THREE.Quaternion()) };
  }
  // the palm is a little past the wrist
  const fore = rest.haL.pos.distanceTo(rest.elL.pos);
  const back = measureBack(scene, rest);
  scene.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
      o.frustumCulled = false; // skinned bounds don't follow the animation
    }
  });
  return { name, wrapper, rest, back, palm: Math.min(0.09, fore * 0.3), kitMaterials: classifyMaterials(scene) };
}

// Where the shirt's back is (for the name + number): the rearmost skin vertices between the
// chest bone and the neck, near the spine. Coordinates are in rig space (the wrapper sits at the
// origin, so world space is rig space).
function measureBack(scene, rest) {
  const top = rest.neck ? rest.neck.pos.y - 0.07 : rest.head.pos.y - 0.14;
  const bottom = Math.min(rest.chest.pos.y, top - 0.12) - 0.08;
  const cx = rest.chest.pos.x;
  const cz = rest.chest.pos.z;
  const zs = [];
  const v = new THREE.Vector3();
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const n = o.geometry.attributes.position.count;
    const step = Math.max(1, Math.floor(n / 30000));
    for (let i = 0; i < n; i += step) {
      o.getVertexPosition(i, v);
      v.applyMatrix4(o.matrixWorld);
      if (v.y > bottom && v.y < top && Math.abs(v.x - cx) < 0.07 && v.z < cz) zs.push(v.z);
    }
  });
  if (zs.length < 5) return null;
  zs.sort((a, b) => a - b);
  // a low percentile, so long hair or a stray strap doesn't push the print off the shirt
  const z = zs[Math.floor(zs.length * 0.1)];
  const shoulders = rest.shL.pos.distanceTo(rest.shR.pos);
  return { x: cx, y: (top + bottom) / 2, z: z - 0.012, w: Math.min(0.34, shoulders * 0.78), tilt: -0.08 };
}

const SHIRT = /shirt|jersey|top|torso|tshirt|tee|upper|jacket|hoodie|polo|kit|uniform|cloth/i;
const TROUSERS = /pant|trouser|bottom|lower|jean|short|legs?\b|leggings/i;
function classifyMaterials(scene) {
  const out = { shirt: new Set(), trousers: new Set() };
  scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      const label = `${m.name} ${o.name}`;
      if (TROUSERS.test(label)) out.trousers.add(m.name || m.uuid);
      else if (SHIRT.test(label)) out.shirt.add(m.name || m.uuid);
    }
  });
  return out;
}

// ---------- loading ----------
const isGlb = (buf) => new TextDecoder().decode(new Uint8Array(buf, 0, 4)) === "glTF";
const isGltfJson = (buf) => /^\s*\{/.test(new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(64, buf.byteLength))));
const isFbx = (buf) => /^Kaydara FBX|^; FBX/.test(new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(32, buf.byteLength))));

async function parseModel(buf, url, base) {
  if (buf.byteLength < 64) return null;
  if (isGlb(buf) || (/\.gltf$/i.test(url) && isGltfJson(buf))) {
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    return (await new GLTFLoader().parseAsync(buf, base)).scene;
  }
  if (isFbx(buf)) {
    const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js");
    return new FBXLoader().parse(buf, base);
  }
  return null; // e.g. the dev server answering a missing file with index.html
}

// ---------- the model library: models added in the app (Cache Storage, works offline) ----------
// Each player can use their own model (look.model = id); one can be the default for everyone.
const MODEL_CACHE = "playerinfo-models";
const LEGACY_KEY = "/__user-character__"; // the single "your model" of earlier versions
const fileKey = (id) => (id === "legacy" ? LEGACY_KEY : `/__model__/${id}`);
const INDEX_KEY = "playerinfo.models.v1";
const DEFAULT_KEY = "playerinfo.models.default.v1";
const hasCaches = () => typeof caches !== "undefined";
const readLS = (k, fallback) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
};
const writeLS = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event("playerinfo-models"));
};
export const listModels = () => readLS(INDEX_KEY, []);
export const getDefaultModel = () => readLS(DEFAULT_KEY, "") || "";
export function setDefaultModel(id) {
  writeLS(DEFAULT_KEY, id || "");
  cache = null;
}
let migrated = null;
function migrateLegacy() {
  if (!migrated) {
    migrated = (async () => {
      if (!hasCaches() || listModels().some((m) => m.id === "legacy")) return;
      const r = await (await caches.open(MODEL_CACHE)).match(LEGACY_KEY);
      if (!r) return;
      writeLS(INDEX_KEY, [...listModels(), { id: "legacy", name: decodeURIComponent(r.headers.get("x-name") || "My model") }]);
      if (readLS(DEFAULT_KEY, null) === null) setDefaultModel("legacy");
    })().catch(() => {});
  }
  return migrated;
}
// Checks the file really is a humanoid rig, then keeps it. Resolves to { id, name }.
export async function addModel(file) {
  if (!hasCaches()) throw new Error("This browser can't store models.");
  const buf = await file.arrayBuffer();
  const scene = await parseModel(buf, file.name, "");
  if (!scene) throw new Error("That file isn't a .glb or .fbx model.");
  const tpl = calibrate(scene, { name: file.name });
  if (!tpl) throw new Error("That model has no humanoid skeleton. It needs hips, spine, arm and leg bones, like a Mixamo character.");
  const id = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const name = file.name.replace(/\.(glb|gltf|fbx)$/i, "");
  const headers = { "x-name": encodeURIComponent(name), "content-type": "application/octet-stream" };
  await (await caches.open(MODEL_CACHE)).put(fileKey(id), new Response(buf, { headers }));
  templates.set(id, Promise.resolve(tpl));
  writeLS(INDEX_KEY, [...listModels(), { id, name }]);
  return { id, name };
}
export async function removeModel(id) {
  if (hasCaches()) await (await caches.open(MODEL_CACHE)).delete(fileKey(id));
  templates.delete(id);
  writeLS(INDEX_KEY, listModels().filter((m) => m.id !== id));
  if (getDefaultModel() === id) setDefaultModel("");
}
const templates = new Map();
// → calibrated template, or null if it's gone
export function loadModelById(id) {
  if (!id) return Promise.resolve(null);
  if (!templates.has(id)) {
    templates.set(
      id,
      (async () => {
        await migrateLegacy();
        if (!hasCaches()) return null;
        const res = await (await caches.open(MODEL_CACHE)).match(fileKey(id));
        if (!res) return null;
        const scene = await parseModel(await res.arrayBuffer(), "model.glb", "");
        return scene ? calibrate(scene, { name: listModels().find((m) => m.id === id)?.name || id }) : null;
      })().catch(() => null)
    );
  }
  return templates.get(id);
}
export async function libraryReady() {
  await migrateLegacy();
  return listModels();
}

// earlier single-model API (still used by the in-video panel)
export async function userModelName() {
  await migrateLegacy();
  const id = getDefaultModel();
  return listModels().find((m) => m.id === id)?.name || "";
}
export async function saveUserModel(file) {
  const m = await addModel(file);
  setDefaultModel(m.id);
  return m.name;
}
export async function clearUserModel() {
  setDefaultModel("");
}

async function loadOne(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    return null;
  }
  if (!res?.ok) return null;
  return parseModel(await res.arrayBuffer(), url, url.slice(0, url.lastIndexOf("/") + 1));
}

let cache = null;
// → { players: [template…], umpire: template|null } or null when no usable model is installed
export function loadModels(baseUrl = "/") {
  if (cache) return cache;
  cache = (async () => {
    // a model picked in the app wins over the ones shipped in public/models
    await migrateLegacy();
    const def = getDefaultModel();
    if (def) {
      const t = await loadModelById(def);
      if (t) return { players: [t], umpire: null, defaultId: def };
    }
    const dir = `${baseUrl}models/`;
    let list = null;
    try {
      const r = await fetch(`${dir}models.json`);
      if (r.ok && (r.headers.get("content-type") || "").includes("json")) list = await r.json();
    } catch {
      /* no manifest */
    }
    const players = list?.players?.length ? list.players : ["cricketer.glb", "cricketer.fbx"];
    const prep = async (file) => {
      try {
        const scene = await loadOne(dir + file);
        return scene ? calibrate(scene, { name: file }) : null;
      } catch (e) {
        console.warn(`[3D] could not load models/${file}`, e);
        return null;
      }
    };
    const found = [];
    for (const f of players) {
      const t = await prep(f);
      if (t) found.push(t);
      if (found.length && !list?.players) break; // default names: the first one that exists
    }
    if (!found.length) return null;
    const umpire = list?.umpire ? await prep(list.umpire) : null;
    return { players: found, umpire };
  })();
  return cache;
}
