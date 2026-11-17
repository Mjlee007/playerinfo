// How a player looks in the 3D highlights. Stored on the player as `look`; players without one get
// a stable look made from their name, so the same player always looks the same.
export const SKIN_TONES = ["#f3d0b0", "#e8b98f", "#d9a173", "#c68a5e", "#a8714a", "#8d5a3b", "#6e4429", "#4f2f1d"];
export const HAIR_COLORS = ["#121010", "#2b1d14", "#4a3426", "#6b4a2b", "#a07040", "#c9a36a", "#8f8f8f", "#e8e3da"];
export const EYE_COLORS = ["#2a1810", "#4a2c18", "#6b4a26", "#5f6b3a", "#3f6f8f", "#6b7680"];
export const GEAR_COLORS = ["team", "#111827", "#ffffff", "#1e3a8a", "#b91c1c", "#15803d", "#f59e0b", "#7c3aed", "#ec4899", "#0ea5e9"];
export const SHOE_COLORS = ["#f4f4f2", "#111827", "#1e3a8a", "#b91c1c", "#9ca3af", "#f59e0b"];
export const UMPIRE_SHIRTS = ["#f4f4ef", "#111827", "#ec4899", "#1d4ed8", "#0f766e", "#fde047"];
export const UMPIRE_TROUSERS = ["#1f2937", "#111827", "#f4f4ef", "#4b5563", "#1e3a8a"];

export const FACE_SHAPES = [["oval", "Oval"], ["round", "Round"], ["square", "Square"], ["long", "Long"], ["slim", "Slim"]];
export const NOSES = [["small", "Small"], ["medium", "Medium"], ["large", "Large"]];
export const BROWS = [["thin", "Thin"], ["medium", "Medium"], ["thick", "Thick"]];
export const HAIR_STYLES = [["short", "Short"], ["buzz", "Buzz cut"], ["curly", "Curly"], ["long", "Long"], ["spiky", "Spiky"], ["bald", "Bald"]];
export const BEARDS = [["none", "Clean shaven"], ["stubble", "Stubble"], ["short", "Short beard"], ["full", "Full beard"], ["goatee", "Goatee"], ["moustache", "Moustache"]];
export const BUILDS = [["slim", "Slim"], ["athletic", "Athletic"], ["strong", "Strong"], ["heavy", "Heavy"]];
export const HEADWEAR = [["cap", "Cap"], ["capBack", "Cap (backwards)"], ["floppy", "Sun hat"], ["headband", "Headband"], ["none", "Nothing"]];
export const UMPIRE_HATS = [["umpire", "Wide-brim hat"], ["cap", "Cap"], ["none", "Nothing"]];
export const GLASSES = [["none", "None"], ["sports", "Sports wraparound"], ["aviator", "Aviators"], ["round", "Round glasses"]];
export const LENSES = [["dark", "Dark"], ["mirrorBlue", "Blue mirror"], ["mirrorGold", "Gold mirror"], ["clear", "Clear"]];
export const WRISTBANDS = [["none", "None"], ["team", "Team colour"], ["#ffffff", "White"], ["#111827", "Black"]];

const hash = (s) => {
  let h = 2166136261;
  for (const c of String(s || "player")) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};
const pick = (arr, n) => arr[n % arr.length];

// A believable default look from the player's name (South Asian-leaning skin tones by default,
// as most squads in this app are; everything is editable per player).
export function defaultLook(name) {
  const h = hash(name);
  const h2 = hash(`${name}#2`);
  return {
    skin: pick([SKIN_TONES[2], SKIN_TONES[3], SKIN_TONES[4], SKIN_TONES[3], SKIN_TONES[5], SKIN_TONES[1]], h),
    faceShape: pick(["oval", "oval", "round", "square", "long", "slim"], h2),
    nose: pick(["medium", "medium", "small", "large"], h2 >>> 3),
    brows: pick(["medium", "thick", "medium", "thin"], h2 >>> 5),
    eyeColor: pick([EYE_COLORS[0], EYE_COLORS[1], EYE_COLORS[0], EYE_COLORS[2]], h2 >>> 7),
    hair: pick(["short", "short", "buzz", "curly", "short", "long", "spiky"], h >>> 3),
    hairColor: pick([HAIR_COLORS[0], HAIR_COLORS[1], HAIR_COLORS[0], HAIR_COLORS[2]], h >>> 6),
    beard: pick(["none", "stubble", "short", "stubble", "full", "none", "moustache", "goatee"], h >>> 9),
    build: pick(["athletic", "athletic", "slim", "strong", "athletic", "heavy"], h >>> 12),
    height: Math.round(168 + ((h >>> 15) % 22)), // cm
    headwear: pick(["cap", "cap", "cap", "floppy", "capBack", "cap", "headband"], h2 >>> 9),
    capColor: "team",
    helmetColor: "team",
    glasses: pick(["none", "none", "none", "none", "sports", "none", "aviator"], h2 >>> 11),
    lens: pick(["dark", "mirrorBlue", "mirrorGold"], h2 >>> 13),
    shoes: pick([SHOE_COLORS[0], SHOE_COLORS[0], SHOE_COLORS[1], SHOE_COLORS[0]], h2 >>> 15),
    shoeAccent: "team",
    wristbands: pick(["none", "none", "team", "#ffffff"], h2 >>> 17),
    shirtName: "",
    umpireHat: "umpire",
    umpireShirt: UMPIRE_SHIRTS[0],
    umpireTrousers: UMPIRE_TROUSERS[0],
  };
}

const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v || "");
const oneOf = (v, list) => (list.some(([k]) => k === v) ? v : undefined);
const colorOrTeam = (v) => (v === "team" || isHex(v) ? v : undefined);

// Fill gaps / clamp values from storage.
export function lookFor(player) {
  const base = defaultLook(player?.name);
  const l = player?.look || {};
  return {
    skin: isHex(l.skin) ? l.skin : base.skin,
    faceShape: oneOf(l.faceShape, FACE_SHAPES) || base.faceShape,
    nose: oneOf(l.nose, NOSES) || base.nose,
    brows: oneOf(l.brows, BROWS) || base.brows,
    eyeColor: isHex(l.eyeColor) ? l.eyeColor : base.eyeColor,
    hair: oneOf(l.hair, HAIR_STYLES) || base.hair,
    hairColor: isHex(l.hairColor) ? l.hairColor : base.hairColor,
    beard: oneOf(l.beard, BEARDS) || base.beard,
    build: oneOf(l.build, BUILDS) || base.build,
    height: Math.min(205, Math.max(150, Number(l.height) || base.height)),
    headwear: oneOf(l.headwear, HEADWEAR) || base.headwear,
    capColor: colorOrTeam(l.capColor) || base.capColor,
    helmetColor: colorOrTeam(l.helmetColor) || base.helmetColor,
    glasses: oneOf(l.glasses, GLASSES) || base.glasses,
    lens: oneOf(l.lens, LENSES) || base.lens,
    shoes: isHex(l.shoes) ? l.shoes : base.shoes,
    shoeAccent: colorOrTeam(l.shoeAccent) || base.shoeAccent,
    wristbands: l.wristbands === "none" || colorOrTeam(l.wristbands) ? l.wristbands : base.wristbands,
    shirtName: typeof l.shirtName === "string" ? l.shirtName.slice(0, 14) : "",
    umpireHat: oneOf(l.umpireHat, UMPIRE_HATS) || base.umpireHat,
    umpireShirt: isHex(l.umpireShirt) ? l.umpireShirt : base.umpireShirt,
    umpireTrousers: isHex(l.umpireTrousers) ? l.umpireTrousers : base.umpireTrousers,
    // 3D model id from the model library ("builtin" = the code-built body; unset = the default)
    model: typeof l.model === "string" && l.model ? l.model : undefined,
  };
}

// Everything that changes the built body / head (model and shirt name are handled elsewhere).
const KEY_FIELDS = ["skin", "faceShape", "nose", "brows", "eyeColor", "hair", "hairColor", "beard", "build", "height", "headwear", "capColor", "helmetColor", "glasses", "lens", "shoes", "shoeAccent", "wristbands", "umpireHat"];
export const lookKey = (l) => (l ? KEY_FIELDS.map((k) => l[k]).join("|") : "");

// A random look (for the "Randomize" button).
export function randomLook() {
  const r = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const k = (list) => r(list)[0];
  return {
    skin: r(SKIN_TONES),
    faceShape: k(FACE_SHAPES),
    nose: k(NOSES),
    brows: k(BROWS),
    eyeColor: r(EYE_COLORS),
    hair: k(HAIR_STYLES),
    hairColor: r(HAIR_COLORS.slice(0, 6)),
    beard: k(BEARDS),
    build: k(BUILDS),
    height: 165 + Math.floor(Math.random() * 28),
    headwear: k(HEADWEAR),
    capColor: Math.random() < 0.6 ? "team" : r(GEAR_COLORS),
    helmetColor: Math.random() < 0.7 ? "team" : r(GEAR_COLORS),
    glasses: Math.random() < 0.6 ? "none" : k(GLASSES.slice(1)),
    lens: k(LENSES),
    shoes: r(SHOE_COLORS),
    shoeAccent: Math.random() < 0.6 ? "team" : r(GEAR_COLORS.slice(1)),
    wristbands: k(WRISTBANDS),
  };
}
