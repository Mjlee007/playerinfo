import { Link } from "react-router-dom";
import { ArrowRight, Award, CalendarClock, Flame, Gauge, Hand, Laugh, Medal, Rocket, Sparkles, Star, Target, Trophy, Users, Zap } from "lucide-react";
import Avatar from "../components/Avatar.jsx";
import CountUp from "../components/CountUp.jsx";
import ScoreStrip from "../components/ScoreStrip.jsx";
import Highlights from "../components/Highlights.jsx";
import {
  ROLES,
  ballsToOvers,
  battingAverage,
  highScoreValue,
  squadTotals,
  strikeRate,
  usePlayers,
} from "../context/PlayersContext.jsx";
import { useStart } from "../context/StartContext.jsx";
import { useFixtures, useSeries } from "../context/FixturesContext.jsx";
import { kickoff } from "../lib/scoring.js";
import { replay } from "../lib/live.js";
import { formatDate, teamCode } from "../lib/series.js";
import { seriesMatchHighlights, topMoments } from "../lib/highlights.js";
import MatchHighlights, { orderMoments } from "../components/MatchHighlights.jsx";
import { momentsFor, useAllMoments } from "../lib/moments.js";

// Last few completed matches, newest first, each with its highlights (auto + added by hand).
function useRecentMatches(n = 3) {
  const { matches } = useSeries();
  const { fixtures } = useFixtures();
  const custom = useAllMoments();
  return [...matches]
    .reverse()
    .slice(0, n)
    .map((m) => ({ m, moments: orderMoments([...seriesMatchHighlights(m, fixtures), ...momentsFor(custom, m.id)]) }));
}

function RecentHighlights({ recent }) {
  if (!recent.length) return null;
  return (
    <section className="recent-hl">
      <div className="section-head">
        <h2>
          <Sparkles size={20} /> Recent match highlights
        </h2>
        <Link to="/matches" className="link-more">
          All matches <ArrowRight size={15} />
        </Link>
      </div>
      <div className="recent-hl-grid">
        {recent.map(({ m, moments }) => (
          <div className="recent-hl-item" key={m.id}>
            <div className="recent-hl-meta">
              <b>{m.title}</b>
              <span className="muted small">
                {m.date ? formatDate(m.date) : ""} · {m.innings.map((i) => `${teamCode(i.team)} ${i.runs}/${i.wickets}`).join(" v ")}
              </span>
            </div>
            <MatchHighlights
              compact
              title="Top moments"
              moments={orderMoments(topMoments(moments, 5))}
              teams={m.innings.map((i) => i.team)}
              playerTitle={m.title}
              date={m.date}
              venue={m.venue}
              matchId={m.id}
            />
            {moments.length > 5 && (
              <Link to={m.manual ? `/schedule/${m.id}` : "/matches"} className="link-more recent-hl-more">
                All {moments.length} highlights <ArrowRight size={15} />
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// Top 5 players by a numeric score; `display` controls what's shown on the right.
const topBy = (players, score, display = score, minInnings = 0) =>
  players
    .filter((p) => score(p) > 0 && p.innings >= minInnings)
    .sort((a, b) => score(b) - score(a))
    .slice(0, 5)
    .map((p) => ({ player: p, value: display(p) }));

function Leaderboard({ title, icon, rows }) {
  return (
    <section className="card">
      <h3 className="card-title">
        {icon} {title}
      </h3>
      {rows.length === 0 ? (
        <p className="muted small">No stats recorded yet.</p>
      ) : (
        <ol className="leaderboard">
          {rows.map(({ player, value }, i) => (
            <li key={player.id} style={{ "--i": i }}>
              <span className="rank">{i + 1}</span>
              <Avatar name={player.name} size="sm" />
              <Link to={`/players/${player.id}`}>{player.name}</Link>
              <strong>{value}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// Headline facts for the highlights carousel.
function buildHighlights(players, fixtures = [], last) {
  const top = (score) => [...players].filter((p) => score(p) > 0).sort((a, b) => score(b) - score(a))[0];
  const out = [];
  // Latest match: its best moment and its funniest one.
  if (last) {
    const byRank = [...last.moments].filter((m) => m.kind !== "result").sort((a, b) => b.rank - a.rank);
    const best = byRank.find((m) => m.kind !== "funny" && m.kind !== "drop");
    const funny = byRank.find((m) => m.kind === "funny" || m.kind === "drop");
    if (best) out.push({ icon: <Sparkles size={22} />, tag: `Moment of ${last.m.title}`, name: best.title, note: best.text, value: "", unit: "" });
    if (funny) out.push({ icon: <Laugh size={22} />, tag: `Funny moment · ${last.m.title}`, name: funny.title, note: funny.text, value: "", unit: "" });
  }
  const next = [...fixtures]
    .filter((f) => f.status === "scheduled" || f.status === "live")
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  if (next) {
    const d = kickoff(next);
    out.push({
      icon: <CalendarClock size={22} />,
      tag: next.status === "live" ? "Scoring in progress" : "Next match",
      name: `${teamCode(next.home)} vs ${teamCode(next.away)} · ${next.title}`,
      value: isNaN(d) ? "TBC" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      unit: isNaN(d) ? "" : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      note: next.venue,
    });
  }
  const runs = top((p) => p.runs);
  if (runs) out.push({ icon: <Trophy size={22} />, tag: "Leading run scorer", name: runs.name, value: runs.runs.toLocaleString(), unit: "runs" });
  const hs = top(highScoreValue);
  if (hs) out.push({ icon: <Star size={22} />, tag: "Best knock", name: hs.name, value: hs.highScore, unit: "high score" });
  const wk = top((p) => p.wickets);
  if (wk)
    out.push({ icon: <Target size={22} />, tag: "Leading wicket taker", name: wk.name, value: wk.wickets, unit: "wkts", note: wk.bestBowling && `Best ${wk.bestBowling}` });
  const six = top((p) => p.sixes);
  if (six) out.push({ icon: <Rocket size={22} />, tag: "Six machine", name: six.name, value: six.sixes, unit: "sixes" });
  const sr = top((p) => (p.ballsFaced >= 100 ? strikeRate(p) : 0));
  if (sr) out.push({ icon: <Zap size={22} />, tag: "Fastest scorer", name: sr.name, value: strikeRate(sr).toFixed(1), unit: "SR", note: "Min 100 balls" });
  const ct = top((p) => p.catches);
  if (ct) out.push({ icon: <Hand size={22} />, tag: "Safe hands", name: ct.name, value: ct.catches, unit: "catches" });
  const tons = top((p) => p.hundreds);
  if (tons) out.push({ icon: <Medal size={22} />, tag: "Centurion", name: tons.name, value: tons.hundreds, unit: tons.hundreds === 1 ? "century" : "centuries" });
  return out;
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

// Live match (with score) or the next fixture, linking straight to scoring.
function MatchSpot({ fixtures }) {
  const live = fixtures.find((f) => f.status === "live");
  const next = live || [...fixtures].filter((f) => f.status === "scheduled").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  if (!next) return null;
  const r = live?.live ? replay(live, live.live.inn) : null;
  const d = kickoff(next);
  return (
    <Link to={`/schedule/${next.id}/live`} className={`card match-spot ${live ? "is-live" : ""}`}>
      <span className="match-spot-tag">
        {live ? <span className="live-dot" /> : <CalendarClock size={15} />} {live ? "Live now" : "Next match"}
      </span>
      <span className="match-spot-teams">
        {teamCode(next.home)} <small>vs</small> {teamCode(next.away)}
      </span>
      <span className="match-spot-info">
        {r ? (
          <>
            <b>
              {teamCode(r.team)} {r.runs}/{r.wickets}
            </b>{" "}
            ({r.oversText} ov)
          </>
        ) : (
          <>
            {next.title} · {isNaN(d) ? "Date TBC" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
            {next.venue ? ` · ${next.venue}` : ""}
          </>
        )}
      </span>
      <span className="match-spot-cta">
        {live ? "Open scoring" : "Start scoring"} <ArrowRight size={16} />
      </span>
    </Link>
  );
}

export default function Dashboard() {
  const { players } = usePlayers();
  const { team } = useStart();
  const { fixtures } = useFixtures();
  const recent = useRecentMatches(3);
  const t = squadTotals(players);

  const roleCounts = ROLES.map((r) => ({ role: r, count: players.filter((p) => p.role === r).length }));
  const unassigned = players.filter((p) => !p.role).length;
  const roleRows = unassigned ? [...roleCounts, { role: "Not set", count: unassigned }] : roleCounts;
  const maxRole = Math.max(1, ...roleRows.map((r) => r.count));

  const best = [...players].sort((a, b) => highScoreValue(b) - highScoreValue(a))[0];

  const stats = [
    { label: "Squad size", value: <CountUp value={players.length} />, icon: <Users size={20} />, tone: "blue" },
    { label: "Total runs", value: <CountUp value={t.runs} />, icon: <Zap size={20} />, tone: "green" },
    { label: "Total wickets", value: <CountUp value={t.wickets} />, icon: <Target size={20} />, tone: "pink" },
    {
      label: best?.highScore ? `Highest score · ${best.name}` : "Highest score",
      value: best?.highScore || "—",
      icon: <Trophy size={20} />,
      tone: "amber",
    },
    { label: "Centuries", value: <CountUp value={t.hundreds} />, icon: <Award size={20} />, tone: "blue" },
    { label: "Half-centuries", value: <CountUp value={t.fifties} />, icon: <Award size={20} />, tone: "green" },
    { label: "Sixes hit", value: <CountUp value={t.sixes} />, icon: <Flame size={20} />, tone: "pink" },
    { label: "Catches", value: <CountUp value={t.catches} />, icon: <Gauge size={20} />, tone: "amber" },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="dash-kicker">{greeting()}</p>
          <h1>{team?.name || "Welcome back"}</h1>
          <p className="muted">Here's how your cricket squad is shaping up.</p>
        </div>
        <div className="row">
          <Link to="/schedule" className="btn ghost">
            <CalendarClock size={16} /> Schedule
          </Link>
          <Link to="/players" className="btn primary">
            View players <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <MatchSpot fixtures={fixtures} />

      <ScoreStrip
        tag="Season"
        heading="Squad totals"
        panels={[
          {
            title: "Batting",
            score: t.runs,
            wickets: t.dismissals,
            overs: ballsToOvers(t.balls),
            chips: [
              ["CRR", t.runRate, 2],
              ["SR", t.strikeRate, 1],
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
            ],
          },
        ]}
      >
        <Highlights items={buildHighlights(players, fixtures, recent[0])} />
      </ScoreStrip>

      <RecentHighlights recent={recent} />

      <div className="stat-grid">
        {stats.map((s, i) => (
          <div className="card stat" key={s.label} style={{ "--i": i }}>
            <span className={`stat-icon ${s.tone}`}>{s.icon}</span>
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="muted small">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <Leaderboard title="Most runs" icon={<Zap size={18} />} rows={topBy(players, (p) => p.runs)} />
        <Leaderboard title="Most wickets" icon={<Target size={18} />} rows={topBy(players, (p) => p.wickets)} />
        <Leaderboard
          title="Highest scores"
          icon={<Trophy size={18} />}
          rows={topBy(players, highScoreValue, (p) => p.highScore)}
        />
        <Leaderboard
          title="Best batting average"
          icon={<Gauge size={18} />}
          rows={topBy(players, battingAverage, (p) => battingAverage(p).toFixed(2), 10)}
        />
        <Leaderboard title="Most sixes" icon={<Flame size={18} />} rows={topBy(players, (p) => p.sixes)} />
        <section className="card">
          <h3 className="card-title">
            <Users size={18} /> Squad by role
          </h3>
          <div className="bars">
            {roleRows.map((r) => (
              <div className="bar-row" key={r.role}>
                <span className="bar-label">{r.role}</span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ "--w": `${(r.count / maxRole) * 100}%` }} />
                </span>
                <span className="bar-count">{r.count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
