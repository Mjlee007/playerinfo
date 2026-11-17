import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LayoutGrid, List, Plus, RotateCcw, Search } from "lucide-react";
import Avatar from "../components/Avatar.jsx";
import PlayerForm from "../components/PlayerForm.jsx";
import {
  ROLES,
  battingAverage,
  blankPlayer,
  fmt,
  highScoreValue,
  strikeRate,
  usePlayers,
} from "../context/PlayersContext.jsx";

const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name),
  runs: (a, b) => b.runs - a.runs,
  wickets: (a, b) => b.wickets - a.wickets,
  matches: (a, b) => b.matches - a.matches,
  highScore: (a, b) => highScoreValue(b) - highScoreValue(a),
  average: (a, b) => battingAverage(b) - battingAverage(a),
  strikeRate: (a, b) => strikeRate(b) - strikeRate(a),
};

export default function Players() {
  const { players, addPlayer, resetPlayers } = usePlayers();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [sort, setSort] = useState("name");
  const [view, setView] = useState("grid");
  const [adding, setAdding] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .filter((p) => role === "all" || (role === "none" ? !p.role : p.role === role))
      .sort(SORTS[sort]);
  }, [players, query, role, sort]);

  const handleReset = () => {
    if (confirm("Reset the squad to the original player list? Your edits will be lost.")) resetPlayers();
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Players</h1>
          <p className="muted">
            {visible.length} of {players.length} players
          </p>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={handleReset} title="Reset to original list">
            <RotateCcw size={16} /> Reset
          </button>
          <button className="btn primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add player
          </button>
        </div>
      </header>

      <div className="toolbar card">
        <label className="field with-icon grow">
          <Search size={16} />
          <input placeholder="Search players…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="all">All roles</option>
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
          <option value="none">Role not set</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="name">Sort: Name</option>
          <option value="runs">Sort: Runs</option>
          <option value="wickets">Sort: Wickets</option>
          <option value="matches">Sort: Matches</option>
          <option value="highScore">Sort: High score</option>
          <option value="average">Sort: Batting average</option>
          <option value="strikeRate">Sort: Strike rate</option>
        </select>
        <div className="segmented">
          <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-label="Grid view">
            <LayoutGrid size={16} />
          </button>
          <button className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-label="List view">
            <List size={16} />
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="empty card">No players match your filters.</div>
      ) : view === "grid" ? (
        <div className="player-grid">
          {visible.map((p, i) => (
            <Link to={`/players/${p.id}`} className="card player-card" key={p.id} style={{ "--i": Math.min(i, 12) }}>
              {p.jersey && <span className="jersey">#{p.jersey}</span>}
              <Avatar name={p.name} size="lg" />
              <h3>{p.name}</h3>
              <span className={`badge ${p.role ? "" : "muted-badge"}`}>{p.role || "Role not set"}</span>
              <div className="mini-stats">
                <span>
                  <strong>{p.matches}</strong>M
                </span>
                <span>
                  <strong>{p.runs}</strong>R
                </span>
                <span>
                  <strong>{p.wickets}</strong>W
                </span>
                <span>
                  HS <strong>{p.highScore || "—"}</strong>
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Role</th>
                <th>#</th>
                <th className="num">Matches</th>
                <th className="num">Runs</th>
                <th className="num">HS</th>
                <th className="num">Avg</th>
                <th className="num">SR</th>
                <th className="num">50s/100s</th>
                <th className="num">Wickets</th>
                <th className="num">Best</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/players/${p.id}`)}>
                  <td>
                    <span className="row">
                      <Avatar name={p.name} size="sm" /> {p.name}
                    </span>
                  </td>
                  <td>{p.role || <span className="muted">—</span>}</td>
                  <td>{p.jersey || <span className="muted">—</span>}</td>
                  <td className="num">{p.matches}</td>
                  <td className="num">{p.runs}</td>
                  <td className="num">{p.highScore || "—"}</td>
                  <td className="num">{fmt(battingAverage(p))}</td>
                  <td className="num">{fmt(strikeRate(p))}</td>
                  <td className="num">
                    {p.fifties}/{p.hundreds}
                  </td>
                  <td className="num">{p.wickets}</td>
                  <td className="num">{p.bestBowling || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <PlayerForm
          title="Add player"
          initial={blankPlayer}
          onClose={() => setAdding(false)}
          onSubmit={(data) => {
            const id = addPlayer(data);
            setAdding(false);
            navigate(`/players/${id}`);
          }}
        />
      )}
    </div>
  );
}
