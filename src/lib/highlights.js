// Match highlights: the moments worth remembering from a match: wickets, 4s, 6s, milestones,
// star turns and funny moments. Built automatically from the ball-by-ball log when the match
// was scored live; for matches typed in from a scorecard, a ball-by-ball match is rebuilt first
// (reconstruct.js) so they get the same moments. Plus moments people add by hand (moments.js).
//
// moment: { id, kind, title, text, team?, over?, inn?, rank }
// kind: "result" | "star" | "milestone" | "wicket" | "six" | "four" | "funny" | "catch" | "drop" |
//       "noball" | "freehit" | "wide" | "other"
// rank: higher = more headline-worthy (used to pick the top few for recent-match cards).
import { BOWLER_CREDIT, DISMISSALS, computeResult, toSeriesMatch } from "./scoring.js";
import { replay } from "./live.js";
import { commentLine } from "./commentary.js";
import { teamCode, teamName } from "./series.js";
import { reconstructFixture, seriesToFixture } from "./reconstruct.js";

export const KINDS = {
  result: "Result",
  star: "Star turn",
  milestone: "Milestone",
  wicket: "Wicket",
  six: "Six",
  four: "Four",
  funny: "Funny moment",
  catch: "Great catch",
  drop: "Dropped catch",
  noball: "No ball",
  freehit: "Free hit",
  wide: "Wides",
  other: "Moment",
};

// Filters shown above a highlights list.
export const FILTERS = [
  ["all", "All", () => true],
  ["w", "Wickets", (m) => m.kind === "wicket" || m.kind === "catch"],
  ["bound", "4s & 6s", (m) => m.kind === "four" || m.kind === "six"],
  ["star", "Milestones", (m) => m.kind === "milestone" || m.kind === "star" || m.kind === "result"],
  ["funny", "Funny", (m) => m.kind === "funny" || m.kind === "drop"],
  ["x", "Extras", (m) => m.kind === "noball" || m.kind === "freehit" || m.kind === "wide"],
];

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : word === "six" ? "es" : "s"}`;
const hasBalls = (fx) => (fx.live?.events || []).some((list) => list.length);

// ---------- From the live ball log ----------
// synthetic: the log was rebuilt from a scorecard, so skip moments that depend on the exact
// order of balls (they would be made up).
function ballMoments(fx, { synthetic = false } = {}) {
  const out = [];
  const real = !synthetic;
  const add = (m) => out.push({ rank: 1, ...m, id: `${m.inn}-${m.idx ?? "x"}-${m.kind}-${out.length}` });
  const first = replay(fx, 0);

  [0, 1].forEach((k) => {
    const r = k === 0 ? first : replay(fx, k);
    if (!r.events.length) return;
    const team = r.team;
    const bowlerStreak = new Map(); // bowler -> consecutive wicket balls
    let sixRun = { name: "", n: 0, over: "" };

    r.log.forEach((entry, i) => {
      const { e, over, outScore, idx } = entry;
      const c = commentLine(entry);
      // `play`: what the 3D replay needs to act this ball out (see components/replay).
      const play = { how: e.wicket?.how || "", runs: e.runs, extra: e.extra, shot: e.shot || null, striker: e.striker, nonStriker: e.nonStriker, bowler: e.bowler, fielder: e.wicket?.fielder || "", out: e.wicket?.out || "", fh: !!entry.fh };
      const score = `${teamCode(team)} ${entry.score.runs}/${entry.score.wickets}`;
      const base = { inn: k, idx, over, team, bat: team, play, score, synthetic };
      const legalBall = e.extra !== "wd" && e.extra !== "nb";

      // Boundaries
      if (!e.wicket && e.runs === 6 && e.extra !== "b" && e.extra !== "lb") {
        add({ ...base, kind: "six", title: `${entry.fh ? "FREE HIT · " : ""}SIX · ${e.striker}`, text: c.text, rank: entry.fh ? 4 : 2 });
        if (e.extra === "nb" && real) add({ ...base, kind: "funny", title: "Six off a no-ball", text: `${e.bowler} oversteps and ${e.striker} punishes it into the stands. That's 7 off one ball!`, rank: 3 });
        sixRun = sixRun.name === e.striker ? { ...sixRun, n: sixRun.n + 1 } : { name: e.striker, n: 1, over };
        if (sixRun.n === 2 && real) add({ ...base, kind: "star", title: "Back-to-back sixes", text: `${e.striker} goes big twice in a row off ${e.bowler}.`, rank: 3 });
        if (sixRun.n === 3 && real) add({ ...base, kind: "star", title: "Three sixes in a row!", text: `${e.striker} is in the zone. ${e.bowler} doesn't know where to bowl.`, rank: 5 });
      } else if (legalBall || e.extra === "nb") {
        sixRun = { name: "", n: 0, over: "" };
      }
      if (!e.wicket && e.runs === 4 && (!e.extra || e.extra === "nb")) add({ ...base, kind: "four", title: `${entry.fh ? "FREE HIT · " : ""}FOUR · ${e.striker}`, text: c.text, rank: entry.fh ? 3 : 1 });
      // no-balls (the next ball is a free hit) and wasted free hits
      if (e.extra === "nb" && e.runs !== 6) add({ ...base, kind: "noball", title: `No ball · ${e.bowler}`, text: `${e.bowler} oversteps${e.runs ? `, and ${e.runs} off the bat` : ""}. FREE HIT coming up!`, rank: 2 });
      if (entry.fh && legalBall && !e.wicket && e.runs === 0 && !e.extra) add({ ...base, kind: "freehit", title: "Free hit wasted", text: `${e.striker} can only defend the free hit. ${e.bowler} gets away with it.`, rank: 3 });
      if (e.extra === "b" && e.runs === 4 && real) add({ ...base, kind: "funny", title: "Four byes", text: `Past the bat, past the keeper, all the way to the rope. Nobody touched it and it's still 4 runs.`, rank: 3 });

      // Wickets
      if (e.wicket && DISMISSALS[e.wicket.how]?.[3]) {
        const outName = e.wicket.out;
        add({ ...base, kind: "wicket", title: `WICKET · ${outName}`, text: c.text, rank: 3 });
        const sc = outScore || { runs: 0, balls: 0 };
        if (sc.runs === 0 && sc.balls <= 1) add({ ...base, kind: "funny", title: "Golden duck", text: `${outName} is out first ball. Long walk back to the pavilion.`, rank: 4 });
        else if (sc.runs === 0) add({ ...base, kind: "funny", title: "Duck", text: `${outName} goes for 0 off ${plural(sc.balls, "ball")}.`, rank: 3 });
        if (sc.runs === 49 || (sc.runs >= 90 && sc.runs <= 99)) add({ ...base, kind: "funny", title: sc.runs === 49 ? "So close to fifty" : "Nervous nineties", text: `${outName} falls on ${sc.runs}. So near, yet so far.`, rank: 4 });
        if (e.wicket.how === "hw") add({ ...base, kind: "funny", title: "Hit wicket!", text: `${outName} knocks the bails off without any help from the bowler.`, rank: 4 });
        if (e.wicket.how === "ro" && e.wicket.out === e.nonStriker && real) add({ ...base, kind: "funny", title: "Mix-up in the middle", text: `${outName} is run out at the non-striker's end. Someone said yes, someone said no.`, rank: 3 });
        const prev = r.log[i - 1]?.e;
        if (real && prev && prev.striker === outName && prev.runs === 6 && !prev.wicket) add({ ...base, kind: "funny", title: "Hero to zero", text: `${outName} smashes a six, then is out the very next ball.`, rank: 4 });
      }

      // Hat-tricks: consecutive balls by the same bowler that took wickets
      if (real && e.bowler && e.extra !== "wd") {
        const credited = e.wicket && BOWLER_CREDIT.has(e.wicket.how);
        const s = credited ? (bowlerStreak.get(e.bowler) || 0) + 1 : 0;
        bowlerStreak.set(e.bowler, s);
        if (s === 2) add({ ...base, kind: "star", title: "Two in two!", text: `${e.bowler} is on a hat-trick.`, rank: 4 });
        if (s === 3) add({ ...base, kind: "star", title: "HAT-TRICK!", text: `${e.bowler} takes three wickets in three balls!`, rank: 6 });
      }

      // Milestones (fifties, hundreds, partnerships)
      c.milestones.filter((m) => real || !m.includes("partnership")).forEach((m) => add({ ...base, kind: "milestone", title: m.includes("partnership") ? "Partnership" : m.split(" for ")[0].replace("!", ""), text: m, rank: m.includes("HUNDRED") ? 6 : m.includes("FIFTY") ? 5 : 2 }));
    });

    // Over-level moments (only when the real order of balls is known)
    if (real) [...r.overs, ...(r.thisOver.balls.length ? [{ ...r.thisOver, no: r.overs.length + 1, partial: true }] : [])].forEach((o) => {
      const last = o.balls[o.balls.length - 1];
      const base = { inn: k, idx: last?.idx, over: `${o.no}`, team, bat: team, play: { bowler: o.bowler } };
      const wides = o.balls.filter((b) => b.extra === "wd").length;
      if (wides >= 2) add({ ...base, play: { ...base.play, count: wides }, kind: "funny", title: "Wide-o-meter", text: `${o.bowler} sprays ${wides} wides in one over. The umpire's arms are getting a workout.`, rank: 3 });
      if (o.runs >= 20) add({ ...base, kind: "funny", title: "Expensive over", text: `${o.bowler} goes for ${o.runs} in over ${o.no}. One to forget.`, rank: 3 });
      if (!o.partial && o.runs === 0 && o.balls.length === 6) add({ ...base, kind: "star", title: "Maiden over", text: `${o.bowler} bowls six dots in a row.`, rank: 2 });
    });

    // Finish
    if (real && k === 1 && first.events.length) {
      const target = first.runs + 1;
      const ballsLeft = Number(fx.overs) * 6 - r.legal;
      const won = r.runs >= target;
      if ((won && ballsLeft <= 1) || r.runs === first.runs || (!won && target - r.runs <= 3 && ballsLeft <= 0))
        add({ inn: k, idx: r.events.length - 1, over: r.oversText, team, bat: team, kind: "star", title: "Last-over thriller", text: won ? `${teamName(team)} get home with ${plural(ballsLeft, "ball")} to spare!` : r.runs === first.runs ? "Scores level. What a finish!" : `${teamName(team)} fall just short. Heartbreak!`, rank: 6 });
    }
  });
  return out;
}

// ---------- From a scorecard (series match format) ----------
export function summaryMoments(m) {
  const out = [];
  const add = (x) => out.push({ rank: 1, ...x, id: `s-${x.inn}-${x.kind}-${out.length}` });
  m.innings.forEach((inn, k) => {
    const base = { inn: k, team: inn.team, bat: inn.team };
    const bats = inn.batting || [];
    const topBat = [...bats].sort((a, b) => b.runs - a.runs)[0];
    for (const b of bats) {
      const sr = b.balls ? (b.runs / b.balls) * 100 : 0;
      if (b.runs >= 100) add({ ...base, kind: "milestone", title: `HUNDRED · ${b.name}`, text: `${b.name} makes ${b.runs}${b.notOut ? "*" : ""} off ${b.balls} balls.`, rank: 6 });
      else if (b.runs >= 50) add({ ...base, kind: "milestone", title: `FIFTY · ${b.name}`, text: `${b.name} scores ${b.runs}${b.notOut ? "*" : ""} off ${b.balls} balls with ${plural(b.fours, "four")} and ${plural(b.sixes, "six")}.`, rank: 5 });
      else if (b === topBat && b.runs >= 25) add({ ...base, kind: "star", title: `Top score · ${b.name}`, text: `${b.name} leads the way with ${b.runs}${b.notOut ? "*" : ""} (${b.balls}).`, rank: 3 });
      if (b.sixes) add({ ...base, kind: "six", title: `${b.sixes > 1 ? `${b.sixes} sixes` : "SIX"} · ${b.name}`, text: b.sixes >= 3 ? `${b.name} clears the rope ${b.sixes} times. Somebody fetch the ball!` : `${b.name} hits ${b.sixes > 1 ? `${b.sixes} sixes` : "a six"} in the knock of ${b.runs}.`, rank: b.sixes >= 3 ? 4 : 2 });
      if (b.fours >= 3) add({ ...base, kind: "four", title: `${b.fours} fours · ${b.name}`, text: `${b.name} finds the boundary ${b.fours} times.`, rank: 1 });
      if (b.runs >= 20 && sr >= 200) add({ ...base, kind: "star", title: `Blitz · ${b.name}`, text: `${b.runs} off just ${b.balls} balls. Strike rate ${Math.round(sr)}!`, rank: 4 });
      if (!b.notOut && b.runs === 0) add({ ...base, kind: "funny", title: b.balls <= 1 ? "Golden duck" : "Duck", text: b.balls <= 1 ? `${b.name} is out first ball. Long walk back.` : `${b.name} goes for 0 off ${plural(b.balls, "ball")}.`, rank: b.balls <= 1 ? 4 : 3 });
      if (!b.notOut && (b.runs === 49 || (b.runs >= 90 && b.runs <= 99))) add({ ...base, kind: "funny", title: b.runs === 49 ? "So close to fifty" : "Nervous nineties", text: `${b.name} falls on ${b.runs}. So near, yet so far.`, rank: 4 });
    }
    for (const b of inn.bowling || []) {
      if (b.wickets >= 5) add({ ...base, team: b.team, kind: "star", title: `Five-for · ${b.name}`, text: `${b.name} takes ${b.wickets}/${b.runs}. Unplayable!`, rank: 6 });
      else if (b.wickets >= 3) add({ ...base, team: b.team, kind: "star", title: `${b.wickets} wickets · ${b.name}`, text: `${b.name} rips through with ${b.wickets}/${b.runs} in ${b.overs} overs.`, rank: 4 });
      else if (b.wickets) add({ ...base, team: b.team, kind: "wicket", title: `${plural(b.wickets, "wicket")} · ${b.name}`, text: `${b.name} picks up ${b.wickets}/${b.runs} in ${b.overs} overs.`, rank: 2 });
      if (b.balls >= 12 && (b.runs / b.balls) * 6 >= 12) add({ ...base, team: b.team, kind: "funny", title: "Day to forget", text: `${b.name} goes for ${b.runs} in ${b.overs} overs. The batters loved it.`, rank: 3 });
    }
    const catchers = {};
    (inn.catches || []).forEach((c) => (catchers[c] = (catchers[c] || 0) + 1));
    Object.entries(catchers).forEach(([name, n]) => n >= 2 && add({ ...base, team: inn.team === m.innings[0].team ? m.innings[1]?.team : m.innings[0].team, kind: "catch", title: `Safe hands · ${name}`, text: `${name} holds on to ${n} catches.`, rank: 3 }));
    if (topBat && typeof inn.extras === "number" && inn.extras > topBat.runs && inn.extras >= 10)
      add({ ...base, kind: "funny", title: "Mr Extras top-scores", text: `Extras (${inn.extras}) outscore every ${teamName(inn.team)} batter. The bowlers were very generous.`, rank: 4 });
  });
  return out;
}

const resultMoment = (text, winner, potm) =>
  text && { id: "result", kind: "result", title: text, text: potm ? `Player of the match: ${potm.name}` : "", team: winner || undefined, rank: 7 };

// Scorecard-level moments the rebuilt ball log can't know (or would double up).
const FIGURE_ONLY = /^(Five-for|\d+ wickets|Blitz|Day to forget|Mr Extras|Safe hands)/;
function figureMoments(sm, fx) {
  const list = sm ? summaryMoments(sm).filter((m) => FIGURE_ONLY.test(m.title)) : [];
  // bowlers who sprayed wides (true from their figures)
  (fx?.innings || []).forEach((inn, k) =>
    (inn.bowling || []).forEach((b) => {
      const w = Math.round(Number(b.wides) || 0);
      if (w >= 3) list.push({ id: `wd-${k}-${b.name}`, inn: k, kind: "wide", team: inn.team, bat: inn.team, title: `${w} wides · ${b.name}`, text: `${b.name} bowls ${w} wides. The umpire is getting a workout.`, play: { bowler: b.name, count: Math.min(3, w) }, rank: 2 });
    })
  );
  return list;
}
// Highlights rebuilt from a scorecard (fixture-shaped match).
function rebuiltMoments(fx, sm) {
  if (!(fx.innings || []).some((i) => (i.batting || []).some((r) => r.name))) return sm ? summaryMoments(sm) : [];
  return [...ballMoments(reconstructFixture(fx), { synthetic: true }), ...figureMoments(sm, fx)];
}

// All highlights for a scheduled/scored fixture (custom moments are added by the caller).
export function fixtureHighlights(fx) {
  if (!fx || fx.status === "abandoned") return [];
  const sm = (fx.innings || []).some((i) => i.batting.length || i.bowling.length) ? toSeriesMatch(fx) : null;
  const auto = hasBalls(fx) ? ballMoments(fx) : rebuiltMoments(fx, sm);
  const done = sm && fx.status === "completed" && computeResult(fx);
  const r = done && resultMoment(sm.result, sm.winner, sm.potm);
  return r ? [r, ...auto] : auto;
}

// Highlights for a match on the Matches page (seed series or a completed fixture).
export function seriesMatchHighlights(m, fixtures = []) {
  const fx = m.manual ? fixtures.find((f) => f.id === m.id) : null;
  if (fx) return fixtureHighlights(fx);
  const r = resultMoment(m.result, m.winner, m.potm);
  const auto = rebuiltMoments(seriesToFixture(m), m);
  return r ? [r, ...auto] : auto;
}

// The few best moments, for compact cards: result first, then a mix of kinds by rank.
export function topMoments(list, n = 5) {
  const sorted = [...list].sort((a, b) => b.rank - a.rank);
  const picked = [];
  const kinds = new Set();
  // First pass: best of each kind for variety; second pass: fill by rank.
  for (const m of sorted) if (picked.length < n && !kinds.has(m.kind === "four" ? "six" : m.kind)) (picked.push(m), kinds.add(m.kind === "four" ? "six" : m.kind));
  for (const m of sorted) if (picked.length < n && !picked.includes(m)) picked.push(m);
  return picked.sort((a, b) => (a.kind === "result" ? -1 : b.kind === "result" ? 1 : (a.inn ?? 0) - (b.inn ?? 0) || (a.idx ?? 0) - (b.idx ?? 0)));
}
