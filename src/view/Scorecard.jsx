import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hand, Target, Zap } from "lucide-react";
import Avatar from "../components/Avatar.jsx";
import ScoreStrip from "../components/ScoreStrip.jsx";
import {
  ballsToOvers,
  battingAverage,
  bowlingAverage,
  economy,
  fmt,
  oversToBalls,
  squadTotals,
  strikeRate,
  usePlayers,
} from "../context/PlayersContext.jsx";

const TABS = [
  { id: "batting", label: "Batting", icon: Zap },
  { id: "bowling", label: "Bowling", icon: Target },
  { id: "fielding", label: "Fielding", icon: Hand },
];

function PlayerCell({ p, sub }) {
  return (
    <span className="sc-player">
      <Avatar name={p.name} size="sm" />
      <span>
        <span className="sc-name">{p.name}</span>
        <span className="sc-sub">{sub}</span>
      </span>
    </span>
  );
}

export default function Scorecard() {
  const { players } = usePlayers();
  const navigate = useNavigate();
  const [tab, setTab] = useState("batting");
  const t = squadTotals(players);
  const open = (p) => () => navigate(`/players/${p.id}`);

  const batters = players.filter((p) => p.innings > 0).sort((a, b) => b.runs - a.runs);
  const bowlers = players
    .filter((p) => oversToBalls(p.overs) > 0)
    .sort((a, b) => b.wickets - a.wickets || economy(a) - economy(b));
  const fielders = players
    .filter((p) => p.catches + p.stumpings > 0)
    .sort((a, b) => b.catches + b.stumpings - (a.catches + a.stumpings));

  const topRuns = batters[0]?.runs;
  const topWkts = bowlers[0]?.wickets;
  const tabIndex = TABS.findIndex((x) => x.id === tab);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Scorecard</h1>
          <p className="muted">Career numbers for the whole squad, laid out like a match scorecard.</p>
        </div>
      </header>

      <ScoreStrip
        tag="Season"
        heading={`${players.length} players`}
        panels={[
          {
            title: "Batting",
            score: t.runs,
            wickets: t.dismissals,
            overs: ballsToOvers(t.balls),
            chips: [
              ["CRR", t.runRate, 2],
              ["SR", t.strikeRate, 1],
              ["4s", t.fours],
              ["6s", t.sixes],
            ],
          },
          {
            title: "Bowling",
            score: t.conceded,
            wickets: t.wickets,
            overs: ballsToOvers(t.bowlBalls),
            chips: [
              ["Econ", t.economy, 2],
              ["Ct", t.catches],
              ["St", t.stumpings],
            ],
          },
        ]}
      />

      <div className="tabs" role="tablist" style={{ "--tab-i": tabIndex, "--tab-n": TABS.length }}>
        <span className="tab-indicator" />
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <div className="card table-wrap scorecard" key={tab}>
        {tab === "batting" && (
          <table className="table sc-table">
            <thead>
              <tr>
                <th>Batter</th>
                <th className="num">R</th>
                <th className="num">B</th>
                <th className="num">4s</th>
                <th className="num">6s</th>
                <th className="num">SR</th>
                <th className="num hide-sm">Avg</th>
                <th className="num hide-sm">HS</th>
                <th className="num hide-sm">50/100</th>
              </tr>
            </thead>
            <tbody>
              {batters.map((p, i) => (
                <tr key={p.id} onClick={open(p)} style={{ "--i": i }} className={p.runs === topRuns ? "top" : ""}>
                  <td>
                    <PlayerCell p={p} sub={`${p.innings} inns · ${p.notOuts} not out`} />
                  </td>
                  <td className="num sc-main">{p.runs}</td>
                  <td className="num">{p.ballsFaced}</td>
                  <td className="num">{p.fours}</td>
                  <td className="num">{p.sixes}</td>
                  <td className="num">{fmt(strikeRate(p))}</td>
                  <td className="num hide-sm">{fmt(battingAverage(p))}</td>
                  <td className="num hide-sm">{p.highScore || "—"}</td>
                  <td className="num hide-sm">
                    {p.fifties}/{p.hundreds}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  Total <span className="sc-sub">({ballsToOvers(t.balls)} ov, RR {t.runRate.toFixed(2)})</span>
                </td>
                <td className="num sc-main">
                  {t.runs}/{t.dismissals}
                </td>
                <td className="num">{t.balls}</td>
                <td className="num">{t.fours}</td>
                <td className="num">{t.sixes}</td>
                <td className="num">{fmt(t.strikeRate)}</td>
                <td className="hide-sm" />
                <td className="hide-sm" />
                <td className="num hide-sm">
                  {t.fifties}/{t.hundreds}
                </td>
              </tr>
            </tfoot>
          </table>
        )}

        {tab === "bowling" && (
          <table className="table sc-table">
            <thead>
              <tr>
                <th>Bowler</th>
                <th className="num">O</th>
                <th className="num">R</th>
                <th className="num">W</th>
                <th className="num">Econ</th>
                <th className="num hide-sm">Avg</th>
                <th className="num hide-sm">Best</th>
              </tr>
            </thead>
            <tbody>
              {bowlers.map((p, i) => (
                <tr key={p.id} onClick={open(p)} style={{ "--i": i }} className={p.wickets === topWkts ? "top" : ""}>
                  <td>
                    <PlayerCell p={p} sub={p.bowlingStyle || p.role || "—"} />
                  </td>
                  <td className="num">{p.overs}</td>
                  <td className="num">{p.runsConceded}</td>
                  <td className="num sc-main">{p.wickets}</td>
                  <td className="num">{fmt(economy(p))}</td>
                  <td className="num hide-sm">{fmt(bowlingAverage(p))}</td>
                  <td className="num hide-sm">{p.bestBowling || "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{ballsToOvers(t.bowlBalls)}</td>
                <td className="num">{t.conceded}</td>
                <td className="num sc-main">{t.wickets}</td>
                <td className="num">{fmt(t.economy)}</td>
                <td className="hide-sm" />
                <td className="hide-sm" />
              </tr>
            </tfoot>
          </table>
        )}

        {tab === "fielding" && (
          <table className="table sc-table">
            <thead>
              <tr>
                <th>Fielder</th>
                <th className="num">Ct</th>
                <th className="num">St</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {fielders.map((p, i) => (
                <tr key={p.id} onClick={open(p)} style={{ "--i": i }}>
                  <td>
                    <PlayerCell p={p} sub={p.role || "—"} />
                  </td>
                  <td className="num">{p.catches}</td>
                  <td className="num">{p.stumpings}</td>
                  <td className="num sc-main">{p.catches + p.stumpings}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{t.catches}</td>
                <td className="num">{t.stumpings}</td>
                <td className="num sc-main">{t.catches + t.stumpings}</td>
              </tr>
            </tfoot>
          </table>
        )}

        {((tab === "batting" && !batters.length) ||
          (tab === "bowling" && !bowlers.length) ||
          (tab === "fielding" && !fielders.length)) && <div className="empty">No stats recorded yet.</div>}
      </div>
    </div>
  );
}

