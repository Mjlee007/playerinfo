// Rebuild a plausible ball-by-ball match from a scorecard, so matches entered by hand (or the
// seed series) get the same highlights + 3D replays as matches scored live.
//
// What is exact: every batter's runs, balls, 4s, 6s and how they got out (bowler / fielder),
// the batting order, ducks and milestones, each bowler's wides / no-balls, extras.
// What is invented: the order of the balls and which over each happened in. Highlights built
// from this are marked `synthetic`, and moments that depend on exact sequences (hat-tricks,
// expensive overs, back-to-back sixes…) are skipped.
import { ballsText, ensureInnings, oversBalls } from "./scoring.js";
import { blankLive } from "./live.js";

const n = (v) => Math.max(0, Math.round(Number(v) || 0));
function rng(seedText) {
  let h = 2166136261;
  for (const c of String(seedText)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let s = h >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const shuffle = (arr, r) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
const shotFor = (runs, r) => {
  // angle: degrees clockwise from straight (wagon wheel convention); sixes favour the leg side / straight
  const a = runs === 6 ? [300, 340, 0, 20, 250, 280][Math.floor(r() * 6)] + r() * 20 : r() * 360;
  return { a: Math.round(a) % 360, d: runs >= 4 ? 1 : 0.35 + r() * 0.4, left: false };
};

// One batter's deliveries (in a random but deterministic order), ending with the dismissal.
function batterBalls(row, r) {
  let fours = n(row.fours);
  let sixes = n(row.sixes);
  const runs = n(row.runs);
  while (fours * 4 + sixes * 6 > runs && (fours || sixes)) sixes ? sixes-- : fours--;
  const rest = runs - fours * 4 - sixes * 6;
  const out = row.how && row.how !== "notout" && row.how !== "rh";
  // mostly singles, some twos; if that needs more balls than the batter faced, run harder
  let twos = Math.min(Math.floor(rest / 2), Math.round(rest * 0.18));
  let ones = rest - twos * 2;
  let threes = 0;
  if (ones >= 1 && twos >= 1 && r() < 0.25) (ones--, twos--, threes++);
  const room = n(row.balls) - (out ? 1 : 0) - fours - sixes;
  while (ones + twos + threes > room && ones >= 2) (ones -= 2), twos++;
  while (ones + twos + threes > room && ones >= 1 && twos >= 1) ones--, twos--, threes++;
  while (ones + twos + threes > room && twos >= 3) (twos -= 3), (threes += 2);
  const shots = [...Array(sixes).fill(6), ...Array(fours).fill(4), ...Array(threes).fill(3), ...Array(twos).fill(2), ...Array(ones).fill(1)];
  const balls = Math.max(n(row.balls), shots.length + (out ? 1 : 0));
  const dots = balls - shots.length - (out ? 1 : 0);
  const list = shuffle([...shots, ...Array(Math.max(0, dots)).fill(0)], r).map((runs) => ({ runs }));
  if (out) list.push({ runs: 0, wicket: { how: row.how, out: row.name, fielder: row.how === "cb" ? row.bowler : row.fielder || "" }, bowler: row.bowler || "" });
  return list;
}

// Order bowlers' overs so nobody bowls two in a row.
function overPlan(bowling, totalOvers, r) {
  const left = bowling.filter((b) => b.name).map((b) => ({ name: b.name, overs: Math.max(1, Math.ceil(oversBalls(b.overs) / 6)) }));
  if (!left.length) return Array(totalOvers).fill("");
  const plan = [];
  let last = "";
  for (let o = 0; o < totalOvers; o++) {
    const pool = left.filter((b) => b.overs > 0 && b.name !== last);
    const pickFrom = pool.length ? pool : left.filter((b) => b.name !== last).length ? left.filter((b) => b.name !== last) : left;
    pickFrom.sort((a, b) => b.overs - a.overs || (r() < 0.5 ? -1 : 1));
    const b = pickFrom[0];
    b.overs--;
    plan.push(b.name);
    last = b.name;
  }
  return plan;
}

// Rebuild one innings as live-scoring events.
export function rebuildInnings(inn, { seed = "x", maxBalls = 120 } = {}) {
  const r = rng(seed);
  const order = inn.batting.filter((row) => row.name);
  if (order.length === 0) return [];
  const queues = order.map((row) => batterBalls(row, r));
  const legalTotal = Math.min(maxBalls, queues.reduce((s, q) => s + q.length, 0));
  const plan = overPlan(inn.bowling || [], Math.ceil(legalTotal / 6) + 2, r);
  // extras: wides / no-balls placed before random legal deliveries, byes on random dots
  const wides = [];
  const noBalls = [];
  for (const b of inn.bowling || []) {
    for (let i = 0; i < n(b.wides); i++) wides.push(b.name);
    for (let i = 0; i < n(b.noBalls); i++) noBalls.push(b.name);
  }
  const ex = inn.extras || {};
  const wideRuns = Math.max(n(ex.w), wides.length);
  while (wides.length < wideRuns) wides.push("");
  while (noBalls.length < n(ex.nb)) noBalls.push("");
  const before = new Map(); // legal index -> extras to bowl first
  const put = (kind, who) => {
    const at = Math.floor(r() * Math.max(1, legalTotal));
    before.set(at, [...(before.get(at) || []), { kind, who }]);
  };
  wides.forEach((w) => put("wd", w));
  noBalls.forEach((w) => put("nb", w));
  let byes = n(ex.b);
  let legByes = n(ex.lb);

  const events = [];
  let si = 0; // striker index into order
  let ni = 1;
  let next = 2;
  let legal = 0;
  const name = (i) => order[i]?.name || "";
  while (legal < legalTotal) {
    // striker has nothing left (not out): swap ends without a ball
    if (!queues[si]?.length) {
      if (queues[ni]?.length) [si, ni] = [ni, si];
      else break;
    }
    const bowler = plan[Math.floor(legal / 6)] || "";
    for (const x of before.get(legal) || []) {
      // never put a no-ball right before a dismissal that can't happen on a free hit
      const head = queues[si][0];
      const kind = x.kind === "nb" && head?.wicket && head.wicket.how !== "ro" ? "wd" : x.kind;
      events.push({ runs: 0, extra: kind, wicket: null, striker: name(si), nonStriker: name(ni), bowler: x.who || bowler });
    }
    const ball = queues[si].shift();
    const e = { runs: ball.runs, extra: "", wicket: ball.wicket || null, striker: name(si), nonStriker: name(ni), bowler: ball.wicket && ball.bowler ? ball.bowler : bowler };
    if (!e.wicket && e.runs === 0 && (byes || legByes) && r() < 0.35) {
      const kind = byes && (!legByes || r() < 0.5) ? "b" : "lb";
      const take = kind === "b" ? Math.min(byes, byes >= 4 && r() < 0.3 ? 4 : 1) : Math.min(legByes, 1);
      if (kind === "b") byes -= take;
      else legByes -= take;
      Object.assign(e, { extra: kind, runs: take });
    }
    if (e.runs > 0 && !e.extra) e.shot = shotFor(e.runs, r);
    events.push(e);
    legal++;
    if (e.wicket) {
      si = next < order.length ? next++ : -1;
      if (si < 0) break;
    } else if (e.runs % 2 === 1) [si, ni] = [ni, si];
    if (legal % 6 === 0) [si, ni] = [ni, si];
  }
  return events;
}

// A fixture with typed scorecards → same fixture with a synthetic ball-by-ball `live` log.
export function reconstructFixture(fx) {
  const inns = ensureInnings(fx);
  const live = blankLive();
  // No cap at the overs limit: every batter's balls from the card are kept, even when a
  // hand-typed card adds up to a few more balls than the overs allow.
  live.events = inns.map((inn, k) => rebuildInnings(inn, { seed: `${fx.id}-${k}`, maxBalls: Infinity }));
  live.inn = 1;
  return { ...fx, live, synthetic: true };
}

// Seed-series match (summary format) → fixture with typed innings, then reconstructed.
export function seriesToFixture(m) {
  const [i1, i2] = m.innings;
  const r = rng(m.id);
  const toInnings = (inn) => {
    if (!inn) return null;
    // hand out the bowlers' wickets (and catches) to the batters who were out, in order
    const pool = shuffle(inn.bowling.flatMap((b) => Array(n(b.wickets)).fill(b.name)), r);
    const catches = [...(inn.catches || [])];
    const batting = inn.batting.map((b) => {
      if (b.notOut) return { name: b.name, how: "notout", runs: b.runs, balls: b.balls, fours: b.fours, sixes: b.sixes, fielder: "", bowler: "" };
      const bowler = pool.shift();
      let how = "ro";
      let fielder = "";
      if (bowler) {
        const c = catches.length && r() < 0.65 ? catches.shift() : "";
        how = c ? (c === bowler ? "cb" : "c") : r() < 0.6 ? "b" : "lbw";
        fielder = c;
      } else fielder = catches.shift() || "";
      return { name: b.name, how, runs: b.runs, balls: b.balls, fours: b.fours, sixes: b.sixes, fielder, bowler: bowler || "" };
    });
    const extras = n(inn.extras);
    const w = Math.round(extras * 0.55);
    const lb = Math.round(extras * 0.25);
    return {
      team: inn.team,
      batting,
      bowling: inn.bowling.map((b) => ({ name: b.name, overs: b.overs || ballsText(b.balls), runs: b.runs, maidens: 0, wides: "", noBalls: "" })),
      extras: { w, lb, b: Math.max(0, extras - w - lb), nb: 0, p: 0 },
    };
  };
  const home = i1?.team || "nrv";
  return {
    id: m.id,
    no: m.no,
    title: m.title,
    date: m.date,
    venue: m.venue,
    overs: Math.max(1, Math.ceil(Math.max(i1?.balls || 0, i2?.balls || 0) / 6)) || 20,
    home,
    away: i2?.team || (home === "nrv" ? "vpn" : "nrv"),
    toss: { winner: home, decision: "bat" },
    status: "completed",
    xi: {},
    innings: [toInnings(i1), toInnings(i2)].filter(Boolean),
    potm: m.potm || null,
  };
}
