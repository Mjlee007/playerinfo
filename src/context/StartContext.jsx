import { createContext, useContext, useState } from "react";
import { findTeam } from "../model/teams.js";

// Remembers (for this browser tab) which team the user picked on the welcome screen.
const StartContext = createContext(null);
const KEY = "playerinfo.team";

export function StartProvider({ children }) {
  const [team, setTeam] = useState(() => findTeam(sessionStorage.getItem(KEY)));

  const start = (teamId) => {
    const t = findTeam(teamId);
    if (!t) return;
    sessionStorage.setItem(KEY, t.id);
    setTeam(t);
  };
  const exit = () => {
    sessionStorage.removeItem(KEY);
    setTeam(null);
  };

  return <StartContext.Provider value={{ started: !!team, team, start, exit }}>{children}</StartContext.Provider>;
}

export const useStart = () => useContext(StartContext);
