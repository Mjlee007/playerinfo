// Builds an illustrative wagon wheel (scoring directions) for a player.
// There's no ball-by-ball data, so directions are generated deterministically
// from the player's name, batting hand and career totals: the same player
// always gets the same wheel, and the totals match their 4s, 6s and runs.

// Zones for a right-hander, viewed from behind the batter (bowler at the top).
// Angles are degrees clockwise from straight down the ground.
export const ZONES = [
  { id: "longoff", name: "Long off", from: 0, to: 45, base: [12, 9, 16] },
  { id: "cover", name: "Cover", from: 45, to: 90, base: [14, 17, 9] },
  { id: "point", name: "Point", from: 90, to: 135, base: [12, 14, 4] },
  { id: "thirdman", name: "Third man", from: 135, to: 180, base: [9, 10, 3] },
  { id: "fineleg", name: "Fine leg", from: 180, to: 225, base: [10, 11, 6] },
  { id: "squareleg", name: "Square leg", from: 225, to: 270, base: [14, 14, 14] },
  { id: "midwicket", name: "Mid-wicket", from: 270, to: 315, base: [16, 15, 26] },
  { id: "longon", name: "Long on", from: 315, to: 360, base: [13, 10, 22] },
];
// base = relative weight for [1s–3s, 4s, 6s]

function rng(seedText) {
  let h = 2166136261;
  for (const c of seedText) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let s = h >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// Split `n` items across zones by weight (largest remainder, so totals are exact).
function split(n, weights) {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (w / sum) * n);
  const out = raw.map(Math.floor);
  let left = n - out.reduce((a, b) => a + b, 0);
  raw
    .map((r, i) => [r - Math.floor(r), i])
    .sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => left-- > 0 && out[i]++);
  return out;
}

export function buildWagon(player, teamId = "") {
  const runs = Math.max(0, Number(player.runs) || 0);
  let fours = Math.max(0, Number(player.fours) || 0);
  let sixes = Math.max(0, Number(player.sixes) || 0);
  // Guard against inconsistent hand-entered data.
  while (fours * 4 + sixes * 6 > runs && (fours || sixes)) fours ? fours-- : sixes--;
  const otherRuns = runs - fours * 4 - sixes * 6;
  const left = /left/i.test(player.battingStyle || "");
  const rand = rng(`${teamId}|${player.name}`);

  // Each player leans to some areas more than others.
  const bias = ZONES.map(() => 0.55 + rand() * 1.1);
  const w = (k) => ZONES.map((z, i) => z.base[k] * bias[i]);
  const f4 = split(fours, w(1));
  const f6 = split(sixes, w(2));
  const fo = split(otherRuns, w(0));

  const zones = ZONES.map((z, i) => {
    // Left-handers mirror the field.
    const from = left ? 360 - z.to : z.from;
    const to = left ? 360 - z.from : z.to;
    return { ...z, from, to, fours: f4[i], sixes: f6[i], other: fo[i], runs: fo[i] + f4[i] * 4 + f6[i] * 6 };
  });

  // Individual shot lines to draw (sampled so the wheel stays readable).
  const MAX = { other: 48, four: 70, six: 40 };
  const shots = [];
  const sample = (count, max) => (count <= max ? count : max);
  const totalOtherShots = Math.round(otherRuns / 1.35);
  for (const z of zones) {
    const span = z.to - z.from;
    const angle = () => z.from + 4 + rand() * (span - 8);
    const nOther = sample(Math.round((z.other / Math.max(1, otherRuns)) * Math.min(totalOtherShots, MAX.other)), MAX.other);
    for (let k = 0; k < nOther; k++) shots.push({ type: "other", angle: angle(), len: 0.32 + rand() * 0.42, zone: z.id });
    const n4 = fours > MAX.four ? Math.round((z.fours / fours) * MAX.four) : z.fours;
    for (let k = 0; k < n4; k++) shots.push({ type: "four", angle: angle(), len: 0.97 + rand() * 0.03, zone: z.id });
    const n6 = sixes > MAX.six ? Math.round((z.sixes / sixes) * MAX.six) : z.sixes;
    for (let k = 0; k < n6; k++) shots.push({ type: "six", angle: angle(), len: 1.06 + rand() * 0.06, zone: z.id });
  }
  // Draw short shots first, sixes last (on top).
  const order = { other: 0, four: 1, six: 2 };
  shots.sort((a, b) => order[a.type] - order[b.type]);

  return {
    runs,
    fours,
    sixes,
    otherRuns,
    left,
    zones,
    shots,
    sampled: fours > MAX.four || sixes > MAX.six || totalOtherShots > MAX.other,
  };
}
