import nrvSeed from "./players.json";
import vpnSeed from "./vpn-players.json";

// Teams shown on the welcome screen. `accent` drives each tile's glow colour.
// `seed` = the team's starting players with stats (used the first time, and by "Reset").
// To add a player to a team, add an entry to that team's JSON file.
export const TEAMS = [
  { id: "nrv", code: "NRV", name: "NRV Legends", accent: "#ff7a2e", accent2: "#ffc81a", seed: nrvSeed.players },
  // syncSeed: players added to the JSON later (or stats filled in) are merged into an already-saved squad.
  { id: "vpn", code: "VPN", name: "VPN Legends", accent: "#22d3ee", accent2: "#3b82f6", seed: vpnSeed.players, syncSeed: true },
];

export const findTeam = (id) => TEAMS.find((t) => t.id === id) || null;
