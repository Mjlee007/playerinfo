// Ball-by-ball scoring. Each innings is a list of ball events; everything else
// (batting card, bowling figures, extras, fall of wickets, overs) is rebuilt by replaying them,
// so Undo is simply "drop the last event".
//
// event: { runs, extra: "" | "wd" | "nb" | "b" | "lb", wicket: null | { how, out, fielder },
//          striker, nonStriker, bowler }
import { DISMISSALS, ballsText, ensureInnings, maxWickets } from "./scoring.js";

const BOWLER_CREDIT = new Set(["b", "c", "cb", "lbw", "st", "hw"]);
export const isLegal = (e) => e.extra !== "wd" && e.extra !== "nb";
const emptySel = () => ({ striker: "", nonStriker: "", bowler: "" });

export const blankLive = () => ({ inn: 0, events: [[], []], sel: [emptySel(), emptySel()] });

// Total runs a ball adds to the score / charges to the bowler.
const ballRuns = (e) => (e.extra === "wd" ? 1 + e.runs : e.extra === "nb" ? 1 + e.runs : e.runs);
const bowlerRuns = (e) => (e.extra === "b" || e.extra === "lb" ? 0 : ballRuns(e));

export function ballLabel(e) {
  if (e.wicket) return e.runs ? `${e.runs}+W` : "W";
  if (e.extra === "wd") return e.runs ? `${e.runs + 1}wd` : "wd";
  if (e.extra === "nb") return e.runs ? `${e.runs}nb` : "nb";
  if (e.extra === "b") return `${e.runs}b`;
  if (e.extra === "lb") return `${e.runs}lb`;
  return String(e.runs);
}
export const ballTone = (e) =>
  e.wicket ? "w" : e.extra ? "x" : e.runs === 6 ? "six" : e.runs === 4 ? "four" : e.runs === 0 ? "dot" : "run";

export function ballText(e) {
  if (e.wicket) {
    const how = DISMISSALS[e.wicket.how]?.[0] || "Out";
    return `OUT! ${e.wicket.out} · ${how}${e.wicket.fielder ? ` (${e.wicket.fielder})` : ""}${e.runs ? ` · ${e.runs} run${e.runs > 1 ? "s" : ""} completed` : ""}`;
  }
  if (e.extra === "wd") return e.runs ? `Wide, ${e.runs} run${e.runs > 1 ? "s" : ""} taken` : "Wide";
  if (e.extra === "nb") return e.runs ? `No ball, ${e.runs} off the bat` : "No ball";
  if (e.extra === "b") return `${e.runs} bye${e.runs > 1 ? "s" : ""}`;
  if (e.extra === "lb") return `${e.runs} leg bye${e.runs > 1 ? "s" : ""}`;
  return e.runs === 6 ? "SIX!" : e.runs === 4 ? "FOUR!" : e.runs === 0 ? "No run" : `${e.runs} run${e.runs > 1 ? "s" : ""}`;
}

// Rebuild innings k from its events.
export function replay(fx, k) {
  const team = ensureInnings(fx)[k].team;
  const events = fx.live?.events?.[k] || [];
  const bat = new Map();
  const bowl = new Map();
  const getBat = (name) => {
    if (name && !bat.has(name))
      bat.set(name, { name, how: "notout", fielder: "", bowler: "", runs: 0, balls: 0, fours: 0, sixes: 0, fowRuns: "", fowOver: "" });
    return bat.get(name) || { runs: 0, balls: 0, fours: 0, sixes: 0 }; // unnamed slot: count nothing
  };
  const getBowl = (name) => {
    if (name && !bowl.has(name)) bowl.set(name, { name, balls: 0, runs: 0, wides: 0, noBalls: 0, maidens: 0, wickets: 0 });
    return bowl.get(name) || { balls: 0, runs: 0, wides: 0, noBalls: 0, maidens: 0, wickets: 0 };
  };
  const extras = { b: 0, lb: 0, w: 0, nb: 0, p: 0 };
  let runs = 0, wickets = 0, legal = 0;
  let part = { runs: 0, balls: 0 };
  const overs = [];
  const log = []; // per ball: event + snapshots used by commentary
  let cur = { balls: [], runs: 0, bowler: "" };
  let fhNext = false; // free hit: the ball after a no-ball (carries over wides / further no-balls)

  events.forEach((e, idx) => {
    const fh = fhNext;
    fhNext = e.extra === "nb" || (fh && !isLegal(e));
    const ballNo = `${Math.floor(legal / 6)}.${(legal % 6) + 1}`; // commentary number, e.g. 6.3
    const s = getBat(e.striker);
    getBat(e.nonStriker);
    const b = getBowl(e.bowler);
    if (e.extra === "wd") {
      extras.w += 1 + e.runs;
      b.wides += 1 + e.runs;
    } else if (e.extra === "nb") {
      extras.nb += 1;
      b.noBalls += 1;
      s.runs += e.runs;
      s.balls += 1;
      if (e.runs === 4) s.fours++;
      if (e.runs === 6) s.sixes++;
    } else if (e.extra === "b" || e.extra === "lb") {
      extras[e.extra] += e.runs;
      s.balls += 1;
    } else {
      s.runs += e.runs;
      s.balls += 1;
      if (e.runs === 4 && !e.wicket) s.fours++;
      if (e.runs === 6 && !e.wicket) s.sixes++;
    }
    const total = ballRuns(e);
    runs += total;
    b.runs += bowlerRuns(e);
    part.runs += total;
    if (e.extra !== "wd") part.balls += 1;
    if (isLegal(e)) {
      legal++;
      b.balls++;
    }
    const partBefore = part.runs - total;
    let outScore = null;
    if (e.wicket) {
      const o = getBat(e.wicket.out);
      outScore = { runs: o.runs, balls: o.balls };
      const how = e.wicket.how;
      o.how = how;
      o.fielder = how === "cb" ? e.bowler : e.wicket.fielder || "";
      o.bowler = BOWLER_CREDIT.has(how) ? e.bowler : "";
      if (DISMISSALS[how]?.[3]) {
        wickets++;
        o.fowRuns = runs;
        o.fowOver = `${Math.floor(legal / 6)}.${legal % 6}`;
        if (BOWLER_CREDIT.has(how)) b.wickets++;
      }
      part = { runs: 0, balls: 0 };
    }
    const pm = [50, 100, 150].find((m) => !e.wicket && partBefore < m && part.runs >= m);
    log.push({ idx, over: ballNo, e, fh, bat: e.striker ? { runs: s.runs, balls: s.balls } : null, outScore, score: { runs, wickets }, partnershipMilestone: pm || 0 });
    cur.bowler = e.bowler;
    cur.balls.push({ ...e, idx, over: ballNo });
    cur.runs += bowlerRuns(e);
    if (isLegal(e) && legal % 6 === 0) {
      if (cur.runs === 0) b.maidens++;
      overs.push({
        no: legal / 6, ...cur, score: { runs, wickets },
        crease: [e.striker, e.nonStriker].filter(Boolean).map((n) => ({ name: n, runs: bat.get(n)?.runs || 0, balls: bat.get(n)?.balls || 0, out: bat.get(n)?.how !== "notout" })),
        figures: { name: e.bowler, balls: b.balls, runs: b.runs, wickets: b.wickets },
      });
      cur = { balls: [], runs: 0, bowler: "" };
    }
  });

  const innings = {
    team,
    extras,
    batting: [...bat.values()],
    bowling: [...bowl.values()].map((b) => ({ name: b.name, overs: ballsText(b.balls), maidens: b.maidens, runs: b.runs, wides: b.wides, noBalls: b.noBalls })),
  };
  return {
    team, events, innings, runs, wickets, legal, overs, thisOver: cur, partnership: part, log,
    batters: bat, bowlers: bowl,
    freeHitNext: fhNext,
    lastOverBowler: overs.length ? overs[overs.length - 1].bowler : "",
    oversText: `${Math.floor(legal / 6)}.${legal % 6}`,
  };
}

// Is innings k finished (all out, overs used up, or target reached)?
export function inningsOver(fx, k, r = replay(fx, k)) {
  if (r.wickets >= maxWickets(fx, r.team)) return "All out";
  if (r.legal >= Number(fx.overs) * 6) return "Overs complete";
  if (k === 1) {
    const first = replay(fx, 0);
    if (r.runs > first.runs) return "Target reached";
  }
  return "";
}

// Who's where after a ball: odd runs swap ends, the out batter leaves, end of over swaps and needs a new bowler.
export function selAfter(e, legalAfter) {
  let { striker, nonStriker, bowler } = e;
  if (e.runs % 2 === 1) [striker, nonStriker] = [nonStriker, striker];
  if (e.wicket) {
    if (e.wicket.out === striker) striker = "";
    else if (e.wicket.out === nonStriker) nonStriker = "";
  }
  if (isLegal(e) && legalAfter > 0 && legalAfter % 6 === 0) {
    [striker, nonStriker] = [nonStriker, striker];
    bowler = "";
  }
  return { striker, nonStriker, bowler };
}

// Write replayed innings back into the fixture model (so scorecards / series stay in sync).
export function syncInnings(fx) {
  const live = fx.live;
  const inns = ensureInnings(fx).map((inn, k) => (live.events[k]?.length ? replay(fx, k).innings : inn));
  return { innings: inns };
}
