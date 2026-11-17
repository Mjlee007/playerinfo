import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { buildSeries, seedMatches } from "../lib/series.js";
import { blankFixture, countsForSeries, toSeriesMatch } from "../lib/scoring.js";
import { TEAMS } from "../model/teams.js";
import { loadTeamPlayers, usePlayers } from "./PlayersContext.jsx";
import { useStart } from "./StartContext.jsx";

// Scheduled / entered matches, shared by both teams.
const KEY = "playerinfo.fixtures.v1";
const FixturesContext = createContext(null);

const firstNo = seedMatches.length + 1;
const SEED = [
  blankFixture(firstNo, { id: "fx-seed-8", date: "2026-11-14", time: "18:00", venue: "Riverside Ground" }),
  blankFixture(firstNo + 1, { id: "fx-seed-9", date: "2026-11-22", time: "16:30", venue: "Municipal Stadium", home: "vpn", away: "nrv" }),
];

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch {
    /* fall through to seed */
  }
  return SEED;
}

export function FixturesProvider({ children }) {
  const [fixtures, setFixtures] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(fixtures));
    } catch {
      /* storage full or unavailable */
    }
  }, [fixtures]);

  const value = useMemo(() => {
    const nextNo = () => Math.max(seedMatches.length, ...fixtures.map((f) => f.no || 0)) + 1;
    return {
      fixtures,
      nextNo,
      getFixture: (id) => fixtures.find((f) => f.id === id) || null,
      addFixture: (fields) => {
        const fx = blankFixture(nextNo(), fields);
        setFixtures((list) => [...list, fx]);
        return fx;
      },
      updateFixture: (id, patch) =>
        setFixtures((list) => list.map((f) => (f.id === id ? { ...f, ...(typeof patch === "function" ? patch(f) : patch) } : f))),
      deleteFixture: (id) => setFixtures((list) => list.filter((f) => f.id !== id)),
      series: buildSeries([...seedMatches, ...fixtures.filter(countsForSeries).map(toSeriesMatch)]),
    };
  }, [fixtures]);

  return <FixturesContext.Provider value={value}>{children}</FixturesContext.Provider>;
}

export const useFixtures = () => useContext(FixturesContext);
// Seed series + completed manual scorecards, recomputed whenever a scorecard changes.
export const useSeries = () => useContext(FixturesContext).series;

// Both squads by team id: the current team live from context, the other from storage.
export function useSquads() {
  const { team } = useStart();
  const { players, squadsVersion } = usePlayers();
  return useMemo(
    () => Object.fromEntries(TEAMS.map((t) => [t.id, t.id === team?.id ? players : loadTeamPlayers(t.id)])),
    // squadsVersion: re-read the other team after it's edited from match setup
    [team, players, squadsVersion] // eslint-disable-line react-hooks/exhaustive-deps
  );
}
