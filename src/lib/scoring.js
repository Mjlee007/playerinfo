// Manual scorecard model: blank shapes, dismissal wording, innings totals, result,
// validation and conversion into the series match format used by the Matches page.
import { findTeam } from "../model/teams.js";

export const otherSide = (fx, team) => (team === fx.home ? fx.away : fx.home);

// how → [label, needs fielder, needs bowler, counts as a wicket]
export const DISMISSALS = {
  notout: ["Not out", false, false, false],
  b: ["Bowled", false, true, true],
  c: ["Caught", true, true, true],
  cb: ["Caught & bowled", false, true, true],
  lbw: ["LBW", false, true, true],
  st: ["Stumped", true, true, true],
  ro: ["Run out", true, false, true],
  hw: ["Hit wicket", false, true, true],
  rh: ["Retired hurt", false, false, false],
  ret: ["Retired out", false, false, true],
};
export const BOWLER_CREDIT = new Set(["b", "c", "cb", "lbw", "st", "hw"]);

export const dismissalText = (r) => {
  const f = r.fielder || "?";
  const bw = r.bowler || "?";
  switch (r.how) {
    case "b": return `b ${bw}`;
    case "c": return r.fielder && r.fielder === r.bowler ? `c & b ${bw}` : `c ${f} b ${bw}`;
    case "cb": return `c & b ${bw}`;
    case "lbw": return `lbw b ${bw}`;
    case "st": return `st †${f} b ${bw}`;
    case "ro": return r.fielder ? `run out (${f})` : "run out";
    case "hw": return `hit wicket b ${bw}`;
    case "rh": return "retired hurt";
    case "ret": return "retired out";
    default: return "not out";
  }
};

export const isOut = (r) => DISMISSALS[r.how]?.[3] ?? false;

const n = (v) => Math.max(0, Number(v) || 0);

// "3.4" → 22 balls. Invalid ball parts (≥6) are clamped.
export const oversBalls = (o) => {
  const [a, b = "0"] = String(o ?? "").split(".");
  return n(a) * 6 + Math.min(5, n(b));
};
export const ballsText = (balls) => `${Math.floor(balls / 6)}.${balls % 6}`.replace(/\.0$/, "");

export const blankBatter = () => ({ name: "", how: "notout", fielder: "", bowler: "", runs: "", balls: "", fours: "", sixes: "", fowRuns: "", fowOver: "" });
export const blankBowler = () => ({ name: "", overs: "", maidens: "", runs: "", wides: "", noBalls: "" });
export const blankInnings = (team) => ({ team, batting: [], bowling: [], extras: { b: "", lb: "", w: "", nb: "", p: "" } });

export function blankFixture(no, fields = {}) {
  return {
    id: `fx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    no,
    title: `Match ${no}`,
    date: "",
    time: "18:00",
    venue: "",
    overs: 20,
    home: "nrv",
    away: "vpn",
    status: "scheduled", // scheduled | live | completed | abandoned
    toss: { winner: "", decision: "bat" },
    xi: { nrv: [], vpn: [] },
    innings: [],
    potm: null,
    ...fields,
  };
}

// Batting order follows the toss; without a toss the home side bats first.
export function battingOrder(fx) {
  if (!fx.toss?.winner) return [fx.home, fx.away];
  const first = fx.toss.decision === "bat" ? fx.toss.winner : otherSide(fx, fx.toss.winner);
  return [first, otherSide(fx, first)];
}

// Make sure innings exist, in toss order, keeping anything already entered.
export function ensureInnings(fx) {
  const order = battingOrder(fx);
  const byTeam = Object.fromEntries((fx.innings || []).map((i) => [i.team, i]));
  return order.map((t) => byTeam[t] || blankInnings(t));
}

export const maxWickets = (fx, team) => Math.max(1, Math.min(10, (fx.xi?.[team]?.length || 11) - 1));
export const maxBowlerOvers = (fx) => Math.max(1, Math.ceil(n(fx.overs) / 5));

export function extrasTotal(e = {}) {
  return n(e.b) + n(e.lb) + n(e.w) + n(e.nb) + n(e.p);
}

// Bowler wickets are derived from the dismissals, never typed in.
export function bowlerWickets(inn, name) {
  return inn.batting.filter((r) => r.bowler === name && BOWLER_CREDIT.has(r.how)).length;
}

export function inningsTotals(inn) {
  const batRuns = inn.batting.reduce((s, r) => s + n(r.runs), 0);
  const extras = extrasTotal(inn.extras);
  const balls = inn.bowling.reduce((s, b) => s + oversBalls(b.overs), 0);
  const runs = batRuns + extras;
  return {
    runs,
    wickets: inn.batting.filter(isOut).length,
    balls,
    overs: ballsText(balls),
    extras,
    rr: balls ? (runs / balls) * 6 : 0,
    started: inn.batting.some((r) => r.name) || inn.bowling.some((b) => b.name),
  };
}

// Problems a scorer would want flagged. Warnings don't block saving.
export function validateInnings(fx, inn) {
  const out = [];
  const t = inningsTotals(inn);
  const maxBalls = n(fx.overs) * 6;
  const perBowler = maxBowlerOvers(fx) * 6;
  const team = findTeam(inn.team)?.code || inn.team;
  if (maxBalls && t.balls > maxBalls) out.push(`${team} innings has ${t.overs} overs bowled; the match is ${fx.overs} overs a side.`);
  if (t.wickets > maxWickets(fx, inn.team)) out.push(`${t.wickets} wickets is more than a side can lose.`);
  const names = inn.batting.map((r) => r.name).filter(Boolean);
  if (new Set(names).size !== names.length) out.push("A batter is listed twice.");
  for (const r of inn.batting) {
    if (!r.name) continue;
    if (n(r.fours) * 4 + n(r.sixes) * 6 > n(r.runs)) out.push(`${r.name}: boundaries add up to more than ${n(r.runs)} runs.`);
    if (n(r.balls) === 0 && n(r.runs) > 0) out.push(`${r.name}: runs scored but 0 balls faced.`);
    const [, needF, needB] = DISMISSALS[r.how] || [];
    if (needB && !r.bowler) out.push(`${r.name}: pick the bowler for the dismissal.`);
    if (needF && !r.fielder && r.how !== "ro") out.push(`${r.name}: pick the fielder for the dismissal.`);
  }
  for (const b of inn.bowling) {
    if (!b.name) continue;
    const [, part = "0"] = String(b.overs).split(".");
    if (n(part) > 5) out.push(`${b.name}: "${b.overs}" isn't a valid over count (balls go 0–5).`);
    if (oversBalls(b.overs) > perBowler) out.push(`${b.name}: more than ${maxBowlerOvers(fx)} overs.`);
    if (n(b.maidens) > Math.floor(oversBalls(b.overs) / 6)) out.push(`${b.name}: more maidens than complete overs.`);
  }
  const bowlNames = inn.bowling.map((b) => b.name).filter(Boolean);
  if (new Set(bowlNames).size !== bowlNames.length) out.push("A bowler is listed twice.");
  // Runs off the bat + wides + no-balls should equal what the bowlers conceded.
  if (inn.bowling.some((b) => b.name)) {
    const bowlerRuns = inn.bowling.reduce((s, b) => s + n(b.runs), 0);
    const charged = t.runs - n(inn.extras.b) - n(inn.extras.lb) - n(inn.extras.p);
    if (bowlerRuns !== charged)
      out.push(`Bowlers conceded ${bowlerRuns}, but batting runs + wides + no-balls come to ${charged}.`);
    const w = inn.bowling.reduce((s, b) => s + n(b.wides), 0);
    const nb = inn.bowling.reduce((s, b) => s + n(b.noBalls), 0);
    if (w !== n(inn.extras.w)) out.push(`Bowlers' wides (${w}) don't match extras wides (${n(inn.extras.w)}).`);
    if (nb !== n(inn.extras.nb)) out.push(`Bowlers' no-balls (${nb}) don't match extras no-balls (${n(inn.extras.nb)}).`);
  }
  return out;
}

// Result from the two innings (no DLS). Returns { winner, text } or null if not decided yet.
export function computeResult(fx) {
  if (fx.status === "abandoned") return { winner: null, text: "No result" };
  const [i1, i2] = ensureInnings(fx);
  const a = inningsTotals(i1), b = inningsTotals(i2);
  if (!a.started || !b.started) return null;
  const name = (t) => findTeam(t)?.name || t;
  if (b.runs > a.runs) {
    const left = maxWickets(fx, i2.team) - b.wickets;
    return { winner: i2.team, text: `${name(i2.team)} won by ${left} wicket${left === 1 ? "" : "s"}` };
  }
  if (a.runs > b.runs) {
    const by = a.runs - b.runs;
    return { winner: i1.team, text: `${name(i1.team)} won by ${by} run${by === 1 ? "" : "s"}` };
  }
  return { winner: null, text: "Match tied" };
}

// Per-player match impact, used to suggest a Player of the Match.
export function matchImpact(fx) {
  const score = new Map();
  const add = (team, name, v) => name && score.set(`${team}|${name}`, (score.get(`${team}|${name}`) || 0) + v);
  const result = computeResult(fx);
  for (const inn of ensureInnings(fx)) {
    const fielding = otherSide(fx, inn.team);
    for (const r of inn.batting) add(inn.team, r.name, n(r.runs) + (n(r.runs) >= 50 ? 10 : 0));
    for (const b of inn.bowling) {
      const w = bowlerWickets(inn, b.name);
      add(fielding, b.name, w * 22 + (w >= 3 ? 10 : 0));
    }
    for (const r of inn.batting) if ((r.how === "c" || r.how === "st" || r.how === "ro") && r.fielder) add(fielding, r.fielder, 8);
  }
  if (result?.winner) for (const k of score.keys()) if (k.startsWith(`${result.winner}|`)) score.set(k, score.get(k) + 10);
  return [...score.entries()]
    .map(([k, v]) => ({ team: k.split("|")[0], name: k.slice(k.indexOf("|") + 1), impact: v }))
    .sort((x, y) => y.impact - x.impact);
}

export const suggestPotm = (fx) => matchImpact(fx)[0] || null;

// Shape used by series.js / Matches page (same as src/model/matches.json).
export function toSeriesMatch(fx) {
  const result = computeResult(fx) || { winner: null, text: "" };
  const innings = ensureInnings(fx).map((inn) => {
    const t = inningsTotals(inn);
    const fielding = otherSide(fx, inn.team);
    return {
      team: inn.team,
      runs: t.runs,
      wickets: t.wickets,
      balls: t.balls,
      overs: t.overs,
      extras: t.extras,
      batting: inn.batting.filter((r) => r.name).map((r) => ({
        name: r.name, team: inn.team, runs: n(r.runs), balls: n(r.balls), fours: n(r.fours), sixes: n(r.sixes), notOut: !isOut(r),
      })),
      bowling: inn.bowling.filter((b) => b.name).map((b) => ({
        name: b.name, team: fielding, overs: ballsText(oversBalls(b.overs)), balls: oversBalls(b.overs), runs: n(b.runs), wickets: bowlerWickets(inn, b.name),
      })),
      catches: inn.batting
        .filter((r) => r.how === "cb" || r.how === "c")
        .map((r) => (r.how === "cb" ? r.bowler : r.fielder))
        .filter(Boolean),
    };
  });
  return {
    id: fx.id,
    no: fx.no,
    title: fx.title,
    date: fx.date,
    time: fx.time,
    venue: fx.venue,
    toss: fx.toss?.winner ? fx.toss : { winner: fx.home, decision: "bat" },
    innings,
    winner: result.winner,
    result: result.text,
    potm: fx.potm || suggestPotm(fx),
    manual: true,
  };
}

// Only completed scorecards with both innings count towards series stats.
export const countsForSeries = (fx) => fx.status === "completed" && !!computeResult(fx);

// Date + time of a fixture as a Date (local time).
export const kickoff = (fx) => new Date(`${fx.date}T${fx.time || "00:00"}:00`);

// A player of `team` was renamed: update every place this match stores their name
// (playing XI, typed scorecard, live ball log, player of the match).
export function renamePlayerInFixture(fx, team, from, to) {
  if (!from || !to || from === to) return {};
  const sw = (v) => (v === from ? to : v);
  const order = battingOrder(fx);
  const out = {
    xi: { ...fx.xi, [team]: (fx.xi?.[team] || []).map(sw) },
    innings: (fx.innings || []).map((inn) =>
      inn.team === team
        ? { ...inn, batting: inn.batting.map((r) => ({ ...r, name: sw(r.name) })) }
        : {
            ...inn,
            batting: inn.batting.map((r) => ({ ...r, fielder: sw(r.fielder), bowler: sw(r.bowler) })),
            bowling: inn.bowling.map((b) => ({ ...b, name: sw(b.name) })),
          }
    ),
  };
  if (fx.potm?.team === team) out.potm = { ...fx.potm, name: sw(fx.potm.name) };
  if (fx.live) {
    const bats = (i) => order[i] === team;
    out.live = {
      ...fx.live,
      events: fx.live.events.map((list, i) =>
        list.map((e) =>
          bats(i)
            ? { ...e, striker: sw(e.striker), nonStriker: sw(e.nonStriker), wicket: e.wicket && { ...e.wicket, out: sw(e.wicket.out) } }
            : { ...e, bowler: sw(e.bowler), wicket: e.wicket && { ...e.wicket, fielder: sw(e.wicket.fielder) } }
        )
      ),
      sel: fx.live.sel.map((s, i) => (bats(i) ? { ...s, striker: sw(s.striker), nonStriker: sw(s.nonStriker) } : { ...s, bowler: sw(s.bowler) })),
    };
  }
  return out;
}
