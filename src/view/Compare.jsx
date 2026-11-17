import { useMemo, useState } from "react";
import { ArrowLeftRight, GitCompareArrows, Trophy } from "lucide-react";
import Avatar from "../components/Avatar.jsx";
import WagonWheel from "../components/WagonWheel.jsx";
import {
  battingAverage,
  economy,
  highScoreValue,
  loadTeamPlayers,
  strikeRate,
  usePlayers,
} from "../context/PlayersContext.jsx";
import { useStart } from "../context/StartContext.jsx";
import { TEAMS } from "../model/teams.js";
import { useSeries } from "../context/FixturesContext.jsx";

// [label, value getter, digits, lowerIsBetter]
const METRICS = [
  ["Matches", (p) => p.matches, 0],
  ["Runs", (p) => p.runs, 0],
  ["Batting avg", battingAverage, 2],
  ["Strike rate", strikeRate, 1],
  ["High score", highScoreValue, 0],
  ["50s", (p) => p.fifties, 0],
  ["100s", (p) => p.hundreds, 0],
  ["4s", (p) => p.fours, 0],
  ["6s", (p) => p.sixes, 0],
  ["Wickets", (p) => p.wickets, 0],
  ["Economy", economy, 2, true],
  ["Catches", (p) => p.catches, 0],
];

const SERIES_METRICS = [
  ["Series runs", (s) => s?.runs ?? 0, 0],
  ["Series wickets", (s) => s?.wickets ?? 0, 0],
  ["Series SR", (s) => s?.sr ?? 0, 1],
  ["Player of the match", (s) => s?.potm ?? 0, 0],
];

function PlayerPicker({ label, side, value, options, onChange }) {
  return (
    <label className={`field picker ${side}`}>
      <span className="picker-label">
        <i className={`key-swatch ${side}`} /> {label}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {TEAMS.map((t) => (
          <optgroup label={t.name} key={t.id}>
            {options
              .filter((o) => o.team === t.id)
              .map((o) => (
                <option key={o.key} value={o.key}>
                  {o.player.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function Row({ label, a, b, digits, lowerBetter, index }) {
  const max = Math.max(Math.abs(a), Math.abs(b)) || 1;
  const fmtv = (v) => (v ? v.toFixed(digits) : digits ? "—" : "0");
  // Lower-is-better only counts when the player actually has a value (0 economy = didn't bowl).
  const score = (v) => (lowerBetter ? (v ? -v : -Infinity) : v);
  const aWins = a !== b && score(a) > score(b);
  const bWins = a !== b && score(b) > score(a);
  return (
    <div className="cmp-row" style={{ "--i": index }}>
      <span className={`cmp-val a ${aWins ? "win" : ""}`}>{fmtv(a)}</span>
      <span className="cmp-track a">
        <span className="cmp-bar a" style={{ "--w": `${(a / max) * 100}%` }} />
      </span>
      <span className="cmp-label">
        {label}
        {lowerBetter && <small>lower is better</small>}
      </span>
      <span className="cmp-track b">
        <span className="cmp-bar b" style={{ "--w": `${(b / max) * 100}%` }} />
      </span>
      <span className={`cmp-val b ${bWins ? "win" : ""}`}>{fmtv(b)}</span>
    </div>
  );
}

export default function Compare() {
  const { team } = useStart();
  const { players: current } = usePlayers();
  const S = useSeries();

  // Both squads (the current team comes live from context, the other from storage).
  const options = useMemo(
    () =>
      TEAMS.flatMap((t) =>
        (t.id === team?.id ? current : loadTeamPlayers(t.id)).map((p) => ({ key: `${t.id}|${p.id}`, team: t.id, player: p }))
      ),
    [team, current]
  );

  const firstOf = (teamId, skip) => options.find((o) => o.team === teamId && o.key !== skip)?.key;
  const [aKey, setA] = useState(() => firstOf("nrv"));
  const [bKey, setB] = useState(() => firstOf("vpn"));
  const A = options.find((o) => o.key === aKey) || options[0];
  const B = options.find((o) => o.key === bKey) || options[1];

  if (!A || !B) return <div className="page"><div className="empty card">Add at least two players to compare.</div></div>;

  const sA = S.player(A.team, A.player.name);
  const sB = S.player(B.team, B.player.name);
  const winsA = METRICS.filter(([, get, , low]) => {
    const a = get(A.player), b = get(B.player);
    return a !== b && (low ? a && (!b || a < b) : a > b);
  }).length;
  const winsB = METRICS.filter(([, get, , low]) => {
    const a = get(A.player), b = get(B.player);
    return a !== b && (low ? b && (!a || b < a) : b > a);
  }).length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Compare</h1>
          <p className="muted">Pick any two players from either team.</p>
        </div>
      </header>

      <div className="card cmp-pickers">
        <PlayerPicker label="Player A" side="a" value={A.key} options={options} onChange={setA} />
        <button
          className="icon-btn"
          aria-label="Swap players"
          onClick={() => {
            setA(B.key);
            setB(A.key);
          }}
        >
          <ArrowLeftRight size={18} />
        </button>
        <PlayerPicker label="Player B" side="b" value={B.key} options={options} onChange={setB} />
      </div>

      <section className="card cmp-card" key={`${A.key}-${B.key}`}>
        <div className="cmp-head">
          {[A, B].map((o, i) => (
            <div className={`cmp-player ${i ? "b" : "a"}`} key={o.key}>
              <Avatar name={o.player.name} size="lg" />
              <div>
                <h3>{o.player.name}</h3>
                <span className="muted small">
                  <span className={`team-tag ${o.team}`}>{o.team.toUpperCase()}</span> {o.player.role || "Role not set"}
                </span>
              </div>
              <span className="cmp-wins">
                <b>{i ? winsB : winsA}</b> of {METRICS.length} ahead
              </span>
            </div>
          ))}
          <span className="cmp-vs">VS</span>
        </div>

        <div className="cmp-legend viz-legend" role="list">
          <span role="listitem">
            <i className="key-swatch a" /> {A.player.name}
          </span>
          <span role="listitem">
            <i className="key-swatch b" /> {B.player.name}
          </span>
          <span className="muted small">Bars scaled per row · bold = better</span>
        </div>

        <div className="cmp-rows">
          {METRICS.map(([label, get, digits, low], i) => (
            <Row key={label} index={i} label={label} a={get(A.player)} b={get(B.player)} digits={digits} lowerBetter={low} />
          ))}
        </div>

        <h4 className="cmp-sub">
          <Trophy size={16} /> NRV vs VPN series
        </h4>
        <div className="cmp-rows">
          {SERIES_METRICS.map(([label, get, digits], i) => (
            <Row key={label} index={i} label={label} a={get(sA)} b={get(sB)} digits={digits} />
          ))}
        </div>
      </section>

      <h2 className="section-title">
        <GitCompareArrows size={20} /> Scoring wheels
      </h2>
      <div className="dash-grid">
        <WagonWheel player={A.player} teamId={A.team} title={A.player.name} compact />
        <WagonWheel player={B.player} teamId={B.team} title={B.player.name} compact />
      </div>
    </div>
  );
}
