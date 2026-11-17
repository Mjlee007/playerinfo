import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Award, CalendarDays, Crown, Pencil, Target, Trash2, Zap, Hand } from "lucide-react";
import Avatar from "../components/Avatar.jsx";
import PlayerForm from "../components/PlayerForm.jsx";
import ScoreStrip from "../components/ScoreStrip.jsx";
import WagonWheel from "../components/WagonWheel.jsx";
import { useStart } from "../context/StartContext.jsx";
import { useSeries } from "../context/FixturesContext.jsx";
import { formatDate, otherTeam, teamCode } from "../lib/series.js";
import {
  battingAverage,
  bowlingAverage,
  economy,
  fmt,
  strikeRate,
  usePlayers,
} from "../context/PlayersContext.jsx";

function PlayerAwards({ awards, potm }) {
  if (!awards.length && !potm) return null;
  return (
    <section className="player-awards">
      {awards.map((a) => (
        <span className={`award-chip ${a.hero ? "hero" : ""}`} key={a.id}>
          {a.hero ? <Crown size={16} /> : <Award size={16} />}
          <span>
            <b>{a.title}</b>
            <small>{a.figure}</small>
          </span>
        </span>
      ))}
      {potm > 0 && (
        <span className="award-chip">
          <Award size={16} />
          <span>
            <b>
              {potm}× Player of the match
            </b>
            <small>NRV vs VPN series</small>
          </span>
        </span>
      )}
    </section>
  );
}

function RecentMatches({ rows, team }) {
  return (
    <section className="card">
      <h3 className="card-title">
        <CalendarDays size={18} /> Recent matches
      </h3>
      {rows.length === 0 ? (
        <p className="muted small">Didn't feature in the NRV vs VPN series.</p>
      ) : (
        <ul className="form-list">
          {rows.map(({ match: m, bat, bowl, catches, won, potm }, i) => (
            <li key={m.id} style={{ "--i": i }}>
              <span className={`wl ${m.winner ? (won ? "w" : "l") : ""}`} title={won ? "Won" : "Lost"}>
                {m.winner ? (won ? "W" : "L") : "T"}
              </span>
              <span className="form-match">
                <b>
                  {m.title} vs {teamCode(otherTeam(team))}
                </b>
                <small>
                  {formatDate(m.date)} · {m.venue}
                </small>
              </span>
              <span className="form-fig">
                {bat ? (
                  <>
                    <b>
                      {bat.runs}
                      {bat.notOut ? "*" : ""}
                    </b>{" "}
                    <small>({bat.balls})</small>
                  </>
                ) : (
                  <small>DNB</small>
                )}
              </span>
              <span className="form-fig">
                {bowl ? (
                  <>
                    <b>
                      {bowl.wickets}/{bowl.runs}
                    </b>{" "}
                    <small>({bowl.overs})</small>
                  </>
                ) : (
                  <small>—</small>
                )}
              </span>
              <span className="form-extra">
                {catches > 0 && <small>{catches} ct</small>}
                {potm && (
                  <span className="potm-badge" title="Player of the match">
                    <Award size={13} /> POTM
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatTable({ title, icon, rows }) {
  return (
    <section className="card">
      <h3 className="card-title">
        {icon} {title}
      </h3>
      <div className="stat-table">
        {rows.map(([label, value]) => (
          <div key={label}>
            <span className="muted small">{label}</span>
            <strong>{value === "" || value === undefined ? "—" : value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function PlayerDetails() {
  const { id } = useParams();
  const { getPlayer, updatePlayer, deletePlayer } = usePlayers();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const player = getPlayer(id);
  const { team } = useStart();
  const S = useSeries();

  if (!player) {
    return (
      <div className="page">
        <div className="empty card">
          <p>That player doesn't exist.</p>
          <Link to="/players" className="btn primary">
            Back to players
          </Link>
        </div>
      </div>
    );
  }

  const series = S.player(team?.id, player.name);
  const recent = S.playerMatches(team?.id, player.name);
  const myAwards = S.awards().filter((a) => a.team === team?.id && a.name === player.name);

  const handleDelete = () => {
    if (confirm(`Remove ${player.name} from the squad?`)) {
      deletePlayer(player.id);
      navigate("/players");
    }
  };

  const batting = [
    ["Innings", player.innings],
    ["Not outs", player.notOuts],
    ["Runs", player.runs],
    ["Balls faced", player.ballsFaced],
    ["High score", player.highScore],
    ["Average", fmt(battingAverage(player))],
    ["Strike rate", fmt(strikeRate(player))],
    ["100s", player.hundreds],
    ["50s", player.fifties],
    ["4s", player.fours],
    ["6s", player.sixes],
  ];

  const bowling = [
    ["Overs", player.overs],
    ["Runs conceded", player.runsConceded],
    ["Wickets", player.wickets],
    ["Best bowling", player.bestBowling],
    ["Economy", fmt(economy(player))],
    ["Average", fmt(bowlingAverage(player))],
  ];

  const fielding = [
    ["Catches", player.catches],
    ["Stumpings", player.stumpings],
  ];

  const profile = [
    ["Role", player.role],
    ["Jersey number", player.jersey && `#${player.jersey}`],
    ["Batting style", player.battingStyle],
    ["Bowling style", player.bowlingStyle],
  ];

  return (
    <div className="page">
      <Link to="/players" className="back-link">
        <ArrowLeft size={16} /> All players
      </Link>

      <section className="card profile">
        <Avatar name={player.name} size="xl" />
        <div className="profile-info">
          <h1>
            {player.name} {player.jersey && <span className="muted jersey-inline">#{player.jersey}</span>}
          </h1>
          <span className={`badge ${player.role ? "" : "muted-badge"}`}>{player.role || "Role not set"}</span>
          <span className="muted small">
            {[player.battingStyle, player.bowlingStyle].filter(Boolean).join(" · ")}
          </span>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={() => setEditing(true)}>
            <Pencil size={16} /> Edit
          </button>
          <button className="btn danger" onClick={handleDelete}>
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </section>

      <ScoreStrip
        tag="Career"
        heading={`${player.matches} matches`}
        panels={[
          {
            title: "Batting",
            score: player.runs,
            extra: `(${player.ballsFaced})`,
            chips: [
              ["SR", strikeRate(player), 1],
              ["Avg", battingAverage(player), 2],
              ["HS", player.highScore || "—"],
              ["4s", player.fours],
              ["6s", player.sixes],
            ],
          },
          {
            title: "Bowling",
            score: player.wickets,
            wickets: player.runsConceded,
            sep: "-",
            overs: player.overs,
            chips: [
              ["Econ", economy(player), 2],
              ["Best", player.bestBowling || "—"],
              ["Ct", player.catches],
            ],
          },
        ]}
      />

      <PlayerAwards awards={myAwards} potm={series?.potm || 0} />

      <div className="dash-grid wide-left">
        <StatTable title="Batting" icon={<Zap size={18} />} rows={batting} />
        <WagonWheel player={player} teamId={team?.id} />
      </div>
      <div className="dash-grid">
        <StatTable title="Bowling" icon={<Target size={18} />} rows={bowling} />
        <StatTable title="Fielding" icon={<Hand size={18} />} rows={fielding} />
      </div>

      <RecentMatches rows={recent} team={team?.id} />

      <section className="card">
        <h3 className="card-title">Profile</h3>
        <dl className="details">
          {profile.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || <span className="muted">Not set</span>}</dd>
            </div>
          ))}
        </dl>
      </section>

      {editing && (
        <PlayerForm
          title={`Edit ${player.name}`}
          initial={player}
          onClose={() => setEditing(false)}
          onSubmit={(data) => {
            updatePlayer(player.id, data);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}
