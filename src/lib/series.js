// Series stats, awards and per-player match history. Built from the seed series
// (src/model/matches.json) plus any completed scorecards entered on the Schedule page.
// Use buildSeries(list) or the useSeries() hook (FixturesContext) for the live version.
import series from "../model/matches.json";
import { findTeam } from "../model/teams.js";

export { series };
export const seedMatches = series.matches;
export const teamName = (id) => findTeam(id)?.name || id;
export const teamCode = (id) => findTeam(id)?.code || id.toUpperCase();
export const otherTeam = (id) => (id === "nrv" ? "vpn" : "nrv");
export const playerKey = (team, name) => `${team}|${name}`;

export const formatDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const ballsFromOvers = (o) => {
  const [a, b = "0"] = String(o).split(".");
  return Number(a) * 6 + Number(b);
};

// Aggregate every player's series numbers.
function aggregate(matches) {
  const stats = new Map();
  const get = (team, name) => {
    const k = playerKey(team, name);
    if (!stats.has(k))
      stats.set(k, {
        key: k, name, team, matches: new Set(), inns: 0, runs: 0, balls: 0, notOuts: 0, fours: 0, sixes: 0,
        fifties: 0, hs: 0, hsNotOut: false, hsBalls: 0, bBalls: 0, bRuns: 0, wickets: 0,
        best: null, catches: 0, potm: 0,
      });
    return stats.get(k);
  };
  for (const m of matches) {
    for (const inn of m.innings) {
      for (const b of inn.batting) {
        const p = get(b.team, b.name);
        p.matches.add(m.id);
        p.inns++;
        p.runs += b.runs;
        p.balls += b.balls;
        p.fours += b.fours;
        p.sixes += b.sixes;
        if (b.notOut) p.notOuts++;
        if (b.runs >= 50) p.fifties++;
        if (b.runs > p.hs || (b.runs === p.hs && b.notOut)) {
          p.hs = b.runs;
          p.hsNotOut = b.notOut;
          p.hsBalls = b.balls;
        }
      }
      for (const b of inn.bowling) {
        const p = get(b.team, b.name);
        p.matches.add(m.id);
        p.bBalls += b.balls;
        p.bRuns += b.runs;
        p.wickets += b.wickets;
        if (!p.best || b.wickets > p.best.w || (b.wickets === p.best.w && b.runs < p.best.r)) p.best = { w: b.wickets, r: b.runs };
      }
      const fieldingTeam = otherTeam(inn.team);
      for (const c of inn.catches) get(fieldingTeam, c).catches++;
    }
    if (m.potm) get(m.potm.team, m.potm.name).potm++;
  }
  return [...stats.values()].map((p) => ({
    ...p,
    matches: p.matches.size,
    avg: p.inns - p.notOuts > 0 ? p.runs / (p.inns - p.notOuts) : p.runs,
    sr: p.balls ? (p.runs / p.balls) * 100 : 0,
    econ: p.bBalls ? (p.bRuns / p.bBalls) * 6 : 0,
    overs: `${Math.floor(p.bBalls / 6)}.${p.bBalls % 6}`.replace(/\.0$/, ""),
    hsText: p.inns ? `${p.hs}${p.hsNotOut ? "*" : ""}` : "—",
    bestText: p.best ? `${p.best.w}/${p.best.r}` : "—",
    impact: p.runs + p.wickets * 22 + p.catches * 8 + p.potm * 15,
  }));
}

const scoreOf = (matches) => matches.reduce(
  (acc, m) => (m.winner ? { ...acc, [m.winner]: acc[m.winner] + 1 } : { ...acc, tied: acc.tied + 1 }),
  { nrv: 0, vpn: 0, tied: 0 }
);

const top = (list, score, filter = () => true) => list.filter(filter).sort((a, b) => score(b) - score(a))[0] || null;

// Single best innings / spell across the series.
function bestInnings(matches) {
  let best = null;
  for (const m of matches)
    for (const inn of m.innings)
      for (const b of inn.batting)
        if (!best || b.runs > best.runs || (b.runs === best.runs && b.balls < best.balls)) best = { ...b, match: m };
  return best;
}
function bestSpell(matches) {
  let best = null;
  for (const m of matches)
    for (const inn of m.innings)
      for (const b of inn.bowling)
        if (!best || b.wickets > best.wickets || (b.wickets === best.wickets && b.runs < best.runs)) best = { ...b, match: m };
  return best;
}

function awardsOf(matches, seriesPlayers) {
  const pos = top(seriesPlayers, (p) => p.impact);
  const runs = top(seriesPlayers, (p) => p.runs);
  const wkts = top(seriesPlayers, (p) => p.wickets * 1000 - p.econ);
  const six = top(seriesPlayers, (p) => p.sixes * 1000 + p.runs);
  const sr = top(seriesPlayers, (p) => p.sr, (p) => p.balls >= 60);
  const ct = top(seriesPlayers, (p) => p.catches * 1000 + p.impact);
  const hi = bestInnings(matches);
  const spell = bestSpell(matches);
  return [
    pos && { id: "pos", title: "Player of the Series", name: pos.name, team: pos.team, figure: `${pos.runs} runs · ${pos.wickets} wkts · ${pos.potm}× POTM`, hero: true },
    runs && { id: "runs", title: "Most runs", name: runs.name, team: runs.team, figure: `${runs.runs} runs · SR ${runs.sr.toFixed(1)}` },
    wkts && { id: "wkts", title: "Most wickets", name: wkts.name, team: wkts.team, figure: `${wkts.wickets} wkts · Econ ${wkts.econ.toFixed(2)}` },
    hi && { id: "hs", title: "Highest score", name: hi.name, team: hi.team, figure: `${hi.runs}${hi.notOut ? "*" : ""} (${hi.balls}) · ${hi.match.title}` },
    spell && { id: "bb", title: "Best bowling", name: spell.name, team: spell.team, figure: `${spell.wickets}/${spell.runs} (${spell.overs} ov) · ${spell.match.title}` },
    six && { id: "six", title: "Most sixes", name: six.name, team: six.team, figure: `${six.sixes} sixes` },
    sr && { id: "sr", title: "Best strike rate", name: sr.name, team: sr.team, figure: `SR ${sr.sr.toFixed(1)} · min 60 balls` },
    ct && { id: "ct", title: "Most catches", name: ct.name, team: ct.team, figure: `${ct.catches} catches` },
  ].filter(Boolean);
}

// A player's innings in each match they played, newest first.
function playerMatchesOf(matches, team, name) {
  const out = [];
  for (const m of matches) {
    let bat = null, bowl = null, catches = 0;
    for (const inn of m.innings) {
      bat ??= inn.batting.find((b) => b.team === team && b.name === name) || null;
      bowl ??= inn.bowling.find((b) => b.team === team && b.name === name) || null;
      if (inn.team !== team) catches += inn.catches.filter((c) => c === name).length;
    }
    if (bat || bowl || catches)
      out.push({ match: m, bat, bowl, catches, won: m.winner === team, potm: !!m.potm && m.potm.team === team && m.potm.name === name });
  }
  return out.reverse();
}

export const inningsOf = (m, team) => m.innings.find((i) => i.team === team);

// Everything the pages need, for one list of matches (oldest first).
export function buildSeries(list) {
  const matches = [...list].sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")) || a.no - b.no);
  const players = aggregate(matches);
  let awards;
  return {
    matches,
    players,
    score: scoreOf(matches),
    awards: () => (awards ??= awardsOf(matches, players)),
    player: (team, name) => players.find((p) => p.key === playerKey(team, name)) || null,
    playerMatches: (team, name) => playerMatchesOf(matches, team, name),
  };
}
export { ballsFromOvers };
