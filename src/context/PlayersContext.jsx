import { createContext, useContext, useEffect, useState } from "react";
import { findTeam } from "../model/teams.js";
import { useStart } from "./StartContext.jsx";

const PlayersContext = createContext(null);

export const ROLES = ["Batsman", "Bowler", "All-rounder", "Wicket-keeper"];

export const blankPlayer = {
  name: "",
  role: "",
  jersey: "",
  battingStyle: "",
  bowlingStyle: "",
  matches: 0,
  innings: 0,
  notOuts: 0,
  runs: 0,
  ballsFaced: 0,
  highScore: "",
  hundreds: 0,
  fifties: 0,
  fours: 0,
  sixes: 0,
  wickets: 0,
  overs: 0,
  runsConceded: 0,
  bestBowling: "",
  catches: 0,
  stumpings: 0,
};

// Derived stats
export const highScoreValue = (p) => parseInt(p.highScore, 10) || 0;
export const battingAverage = (p) => {
  const outs = p.innings - p.notOuts;
  return outs > 0 ? p.runs / outs : 0;
};
export const strikeRate = (p) => (p.ballsFaced ? (p.runs / p.ballsFaced) * 100 : 0);
export const economy = (p) => {
  const balls = oversToBalls(p.overs);
  return balls ? (p.runsConceded / balls) * 6 : 0;
};
export const bowlingAverage = (p) => (p.wickets ? p.runsConceded / p.wickets : 0);
export const fmt = (n, digits = 2) => (n ? n.toFixed(digits) : "—");

// Cricket helpers
export const ballsToOvers = (balls) => `${Math.floor(balls / 6)}.${balls % 6}`;
// "12.4" overs (cricket notation) -> 76 balls
export const oversToBalls = (overs) => {
  const [o, b = "0"] = String(overs || 0).split(".");
  return (Number(o) || 0) * 6 + Math.min(5, Number(b[0]) || 0);
};
const total = (players, key) => players.reduce((s, p) => s + (Number(p[key]) || 0), 0);
export const squadTotals = (players) => {
  const runs = total(players, "runs");
  const balls = total(players, "ballsFaced");
  const dismissals = players.reduce((s, p) => s + Math.max(0, p.innings - p.notOuts), 0);
  const bowlBalls = players.reduce((s, p) => s + oversToBalls(p.overs), 0);
  const conceded = total(players, "runsConceded");
  const wickets = total(players, "wickets");
  return {
    runs,
    balls,
    dismissals,
    fours: total(players, "fours"),
    sixes: total(players, "sixes"),
    hundreds: total(players, "hundreds"),
    fifties: total(players, "fifties"),
    strikeRate: balls ? (runs / balls) * 100 : 0,
    runRate: balls ? (runs / balls) * 6 : 0,
    bowlBalls,
    conceded,
    wickets,
    economy: bowlBalls ? (conceded / bowlBalls) * 6 : 0,
    catches: total(players, "catches"),
    stumpings: total(players, "stumpings"),
  };
};

// ---------- Per-team storage ----------
// NRV Legends keeps the original storage key so existing edits survive.
const storageKey = (teamId) => (teamId === "nrv" ? "playerinfo.players.v2" : `playerinfo.players.${teamId}.v1`);

const seedPlayers = (teamId) =>
  (findTeam(teamId)?.seed || []).map((p, i) => ({ ...blankPlayer, ...p, id: String(i + 1) }));

// Saved squad for any team (used by the welcome screen for per-team counts).
export const loadTeamPlayers = (teamId) => {
  if (!teamId) return [];
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(teamId)));
    if (Array.isArray(saved)) return syncWithSeed(teamId, saved);
  } catch {
    /* fall through to seed data */
  }
  const fresh = seedPlayers(teamId);
  markSquadSeen(teamId);
  return fresh;
};

// For teams with `syncSeed` (see teams.js), an already-saved squad is kept in step with the
// team's JSON file: new players are appended once, and players that still have no stats get the
// file's stats once. We remember which names were handled, so deleted players stay deleted and
// your own edits are never overwritten.
const seenKey = (teamId) => `${storageKey(teamId)}.squad`;
const filledKey = (teamId) => `${storageKey(teamId)}.stats`;
const seedFor = (teamId) => {
  const team = findTeam(teamId);
  return team?.syncSeed ? team.seed || [] : null;
};
const readList = (key) => {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
};
const markSquadSeen = (teamId, extra = []) => {
  const seed = seedFor(teamId);
  if (!seed) return;
  const names = seed.map((p) => p.name);
  localStorage.setItem(seenKey(teamId), JSON.stringify([...new Set([...extra, ...names])]));
  localStorage.setItem(filledKey(teamId), JSON.stringify([...new Set([...(readList(filledKey(teamId)) || []), ...names])]));
};
const hasNoStats = (p) =>
  !p.role && !p.jersey && ["matches", "innings", "runs", "ballsFaced", "wickets", "catches"].every((k) => !Number(p[k]));

function syncWithSeed(teamId, saved) {
  const seed = seedFor(teamId);
  if (!seed) return saved;
  const seen = readList(seenKey(teamId)) || saved.map((p) => p.name); // saved before tracking existed
  const filled = readList(filledKey(teamId)) || [];
  const byName = new Map(seed.map((p) => [p.name, p]));
  let changed = false;

  // Fill stats for players that are still blank (once per name).
  const updated = saved.map((p) => {
    const src = byName.get(p.name);
    if (!src || filled.includes(p.name) || !hasNoStats(p)) return p;
    changed = true;
    return { ...blankPlayer, ...src, id: p.id };
  });

  // Append players added to the JSON since this squad was saved.
  const base = Date.now();
  const missing = seed.filter((p) => !seen.includes(p.name) && !updated.some((u) => u.name === p.name));
  missing.forEach((p, i) => updated.push({ ...blankPlayer, ...p, id: String(base + i) }));
  if (missing.length) changed = true;

  markSquadSeen(teamId, seen);
  if (changed) localStorage.setItem(storageKey(teamId), JSON.stringify(updated)); // save now, so it's done once
  return changed ? updated : saved;
}

export function PlayersProvider({ children }) {
  const { team } = useStart();
  const teamId = team?.id || null;

  // Keep the squad paired with the team it belongs to, so switching teams
  // never writes one team's players into the other team's storage.
  const [squad, setSquad] = useState(() => ({ teamId, players: loadTeamPlayers(teamId) }));
  if (squad.teamId !== teamId) setSquad({ teamId, players: loadTeamPlayers(teamId) });
  const players = squad.teamId === teamId ? squad.players : [];

  useEffect(() => {
    if (squad.teamId) localStorage.setItem(storageKey(squad.teamId), JSON.stringify(squad.players));
  }, [squad]);

  const setPlayers = (fn) => setSquad((sq) => ({ ...sq, players: fn(sq.players) }));

  const addPlayer = (data) => {
    const id = String(Date.now());
    setPlayers((ps) => [...ps, { ...blankPlayer, ...data, id }]);
    return id;
  };
  const updatePlayer = (id, data) => setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, ...data } : p)));
  const deletePlayer = (id) => setPlayers((ps) => ps.filter((p) => p.id !== id));
  const resetPlayers = () => {
    markSquadSeen(teamId);
    setPlayers(() => seedPlayers(teamId));
  };
  const getPlayer = (id) => players.find((p) => p.id === id);

  // Edit ANY team's squad (used by match setup, where both teams' players can be added,
  // edited or removed). The current team goes through state; the other team is written
  // straight to storage and `squadsVersion` bumps so screens re-read it.
  const [squadsVersion, setSquadsVersion] = useState(0);
  const editTeam = (id, fn) => {
    if (!id) return;
    if (id === teamId) return setPlayers(fn);
    try {
      localStorage.setItem(storageKey(id), JSON.stringify(fn(loadTeamPlayers(id))));
    } catch {
      /* storage full or unavailable */
    }
    setSquadsVersion((v) => v + 1);
  };
  const addTeamPlayer = (id, data) => {
    const pid = String(Date.now());
    editTeam(id, (ps) => [...ps, { ...blankPlayer, ...data, id: pid }]);
    return pid;
  };
  const updateTeamPlayer = (id, pid, data) => editTeam(id, (ps) => ps.map((p) => (p.id === pid ? { ...p, ...data } : p)));
  const deleteTeamPlayer = (id, pid) => editTeam(id, (ps) => ps.filter((p) => p.id !== pid));

  return (
    <PlayersContext.Provider
      value={{
        players, addPlayer, updatePlayer, deletePlayer, resetPlayers, getPlayer,
        squadsVersion, addTeamPlayer, updateTeamPlayer, deleteTeamPlayer,
      }}
    >
      {children}
    </PlayersContext.Provider>
  );
}

export const usePlayers = () => useContext(PlayersContext);
