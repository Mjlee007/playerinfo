import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Award, BarChart3, CalendarClock, CalendarDays, ChevronDown, ClipboardList, Crown, Flame, Hand, MapPin, Medal, Sparkles, Table2, Target, Trophy, Zap } from "lucide-react";
import MatchHighlights, { useMatchMoments } from "../components/MatchHighlights.jsx";
import { seriesMatchHighlights } from "../lib/highlights.js";
import Avatar from "../components/Avatar.jsx";
import CountUp from "../components/CountUp.jsx";
import { useFixtures, useSeries } from "../context/FixturesContext.jsx";
import { formatDate, inningsOf, series, teamCode, teamName } from "../lib/series.js";

const AWARD_ICONS = { pos: Crown, runs: Zap, wkts: Target, hs: Trophy, bb: Medal, six: Flame, sr: Zap, ct: Hand };

function TeamTag({ team }) {
  return <span className={`team-tag ${team}`}>{teamCode(team)}</span>;
}

// ---------- Runs per match (grouped columns, one per team) ----------
function RunsChart({ matches }) {
  const [hover, setHover] = useState(null);
  const [table, setTable] = useState(false);
  const wrap = useRef(null);
  const W = 640, H = 240, padL = 36, padB = 26, padT = 10;
  const top = Math.max(0, ...matches.flatMap((m) => m.innings.map((i) => i.runs)));
  const max = Math.max(200, Math.ceil(top / 50) * 50);
  const ticks = Array.from({ length: max / 50 + 1 }, (_, k) => k * 50);
  const band = (W - padL) / matches.length;
  const barW = Math.min(22, band / 3);
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const col = (x, v) => {
    const top = y(v), bottom = y(0), r = 4;
    return `M${x},${bottom} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${bottom} Z`;
  };
  const show = (m, team) => (e) => {
    const box = wrap.current.getBoundingClientRect();
    setHover({ m, team, x: e.clientX - box.left, y: e.clientY - box.top });
  };

  return (
    <section className="card viz">
      <div className="viz-head">
        <h3 className="card-title">
          <BarChart3 size={18} /> Runs per match
        </h3>
        <button className="viz-toggle" onClick={() => setTable((t) => !t)} aria-pressed={table}>
          <Table2 size={14} /> {table ? "Chart" : "Table"}
        </button>
      </div>
      {table ? (
        <table className="viz-table">
          <thead>
            <tr>
              <th>Match</th>
              <th className="num">NRV Legends</th>
              <th className="num">VPN Legends</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.id}>
                <td>{m.title}</td>
                {["nrv", "vpn"].map((t) => {
                  const i = inningsOf(m, t);
                  return <td className="num" key={t}>{i ? `${i.runs}/${i.wickets} (${i.overs})` : "—"}</td>;
                })}
                <td>{m.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <div className="viz-legend" role="list">
            {["nrv", "vpn"].map((t) => (
              <span role="listitem" key={t}>
                <i className={`key-swatch ${t}`} /> {teamName(t)}
              </span>
            ))}
          </div>
          <div className="viz-plot" ref={wrap} onMouseLeave={() => setHover(null)}>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Runs scored by each team in every match of the series">
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className={t === 0 ? "v-base" : "v-grid"} />
                  <text x={padL - 8} y={y(t)} className="v-tick" textAnchor="end" dominantBaseline="middle">
                    {t}
                  </text>
                </g>
              ))}
              {matches.map((m, i) => {
                const cx = padL + band * i + band / 2;
                return (
                  <g key={m.id}>
                    {["nrv", "vpn"].map((t, k) => {
                      const inn = inningsOf(m, t) || { runs: 0 };
                      const x = k === 0 ? cx - barW - 1 : cx + 1; // 2px surface gap between the pair
                      const on = hover?.m.id === m.id && hover.team === t;
                      return (
                        <g key={t} className={`v-col ${t} ${hover && !on ? "fade" : ""}`} style={{ "--d": `${i * 70 + k * 35}ms` }}>
                          <path d={col(x, inn.runs)} />
                          {/* hit target larger than the mark */}
                          <rect x={x - 3} y={padT} width={barW + 6} height={H - padT - padB} className="v-hit" onMouseMove={show(m, t)} onMouseEnter={show(m, t)} />
                        </g>
                      );
                    })}
                    <text x={cx} y={H - 8} className="v-tick" textAnchor="middle">
                      M{m.no}
                      {m.winner ? (m.winner === "nrv" ? " ·N" : " ·V") : ""}
                    </text>
                  </g>
                );
              })}
            </svg>
            {hover && (() => {
              const inn = inningsOf(hover.m, hover.team);
              return (
                <div className="viz-tip" style={{ left: hover.x, top: hover.y }}>
                  <strong>
                    {hover.m.title} · {formatDate(hover.m.date)}
                  </strong>
                  <span>
                    <i className={`key-swatch ${hover.team}`} /> {teamName(hover.team)} {inn.runs}/{inn.wickets} ({inn.overs} ov)
                  </span>
                  <span className="muted">{hover.m.result}</span>
                </div>
              );
            })()}
          </div>
          <p className="viz-note">·N / ·V under each match marks the winner (NRV / VPN).</p>
        </>
      )}
    </section>
  );
}

// ---------- Match card ----------
function MatchCard({ m, index }) {
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(false);
  const { fixtures } = useFixtures();
  const moments = useMatchMoments(m.id, seriesMatchHighlights(m, fixtures));
  const potm = m.potm;
  return (
    <article className="card match-card" style={{ "--i": index }}>
      <header className="match-meta">
        <span className="match-no">{m.title}</span>
        <span>
          <CalendarDays size={14} /> {formatDate(m.date)}
        </span>
        <span>
          <MapPin size={14} /> {m.venue}
        </span>
      </header>

      <div className="match-teams">
        {m.innings.map((inn) => (
          <div className={`match-team ${m.winner === inn.team ? "won" : m.winner ? "lost" : ""}`} key={inn.team}>
            <TeamTag team={inn.team} />
            <span className="match-team-name">{teamName(inn.team)}</span>
            <span className="match-score">
              {inn.runs}/{inn.wickets}
              <small>({inn.overs} ov)</small>
            </span>
          </div>
        ))}
      </div>

      <p className="match-result">
        <Trophy size={15} /> {m.result}
      </p>

      <div className="match-foot">
        <span className="potm">
          <Award size={15} /> Player of the match: <b>{potm?.name || "—"}</b> {potm && <TeamTag team={potm.team} />}
        </span>
        <button className="link-more" onClick={() => setHl((o) => !o)} aria-expanded={hl}>
          <Sparkles size={15} /> Highlights ({moments.length}) <ChevronDown size={16} className={hl ? "flip" : ""} />
        </button>
        {m.manual ? (
          <Link className="link-more" to={`/schedule/${m.id}`}>
            <ClipboardList size={15} /> Full scorecard
          </Link>
        ) : (
          <button className="link-more" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            Scorecard <ChevronDown size={16} className={open ? "flip" : ""} />
          </button>
        )}
      </div>

      {hl && <MatchHighlights matchId={m.id} moments={moments} teams={m.innings.map((i) => i.team)} playerTitle={`${m.title} · ${m.result || ""}`} date={m.date} venue={m.venue} />}

      {open && (
        <div className="match-detail">
          {m.innings.map((inn) => {
            const topBat = [...inn.batting].sort((a, b) => b.runs - a.runs).slice(0, 3);
            const topBowl = [...inn.bowling].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs).slice(0, 2);
            return (
              <div key={inn.team} className="match-innings">
                <h4>
                  <TeamTag team={inn.team} /> {teamName(inn.team)} innings
                </h4>
                <ul>
                  {topBat.map((b) => (
                    <li key={b.name}>
                      <span>{b.name}</span>
                      <b>
                        {b.runs}
                        {b.notOut ? "*" : ""}
                      </b>
                      <small>
                        ({b.balls}) · {b.fours}×4 {b.sixes}×6
                      </small>
                    </li>
                  ))}
                </ul>
                <h5>Bowling for {teamCode(inn.team === "nrv" ? "vpn" : "nrv")}</h5>
                <ul>
                  {topBowl.map((b) => (
                    <li key={b.name}>
                      <span>{b.name}</span>
                      <b>
                        {b.wickets}/{b.runs}
                      </b>
                      <small>({b.overs} ov)</small>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <p className="muted small">
            Toss: {teamName(m.toss.winner)} chose to {m.toss.decision}.
          </p>
        </div>
      )}
    </article>
  );
}

// ---------- Series leaderboards ----------
function SeriesTable({ title, icon, rows, cols }) {
  return (
    <section className="card table-wrap">
      <h3 className="card-title table-title">
        {icon} {title}
      </h3>
      <table className="table">
        <thead>
          <tr>
            <th>Player</th>
            {cols.map(([label]) => (
              <th className="num" key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.key} className="static">
              <td>
                <span className="row nowrap">
                  <Avatar name={p.name} size="sm" /> {p.name} <TeamTag team={p.team} />
                </span>
              </td>
              {cols.map(([label, get]) => (
                <td className="num" key={label}>
                  {get(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function Matches() {
  const S = useSeries();
  const { fixtures } = useFixtures();
  const { matches, score: seriesScore, players: seriesPlayers } = S;
  const pending = fixtures.filter((f) => f.status === "scheduled" || f.status === "live").length;
  const awards = S.awards();
  const [hero, ...rest] = awards;
  const leader = seriesScore.nrv === seriesScore.vpn ? null : seriesScore.nrv > seriesScore.vpn ? "nrv" : "vpn";
  const recent = [...matches].reverse();
  const batters = [...seriesPlayers].filter((p) => p.inns).sort((a, b) => b.runs - a.runs).slice(0, 8);
  const bowlers = [...seriesPlayers].filter((p) => p.bBalls).sort((a, b) => b.wickets - a.wickets || a.econ - b.econ).slice(0, 8);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Matches</h1>
          <p className="muted">
            {series.name} · {matches.length} played{pending ? ` · ${pending} to come` : ""} · {series.format}
          </p>
        </div>
        <Link to="/schedule" className="btn ghost">
          <CalendarClock size={18} /> Schedule
        </Link>
      </header>

      {/* Series scoreline */}
      <section className="score-strip series-strip">
        <div className="score-strip-head">
          <span className="live-pill">
            <span className="live-dot" /> Series
          </span>
          <span className="score-strip-heading">{series.name}</span>
        </div>
        <div className="series-line">
          {["nrv", "vpn"].map((t, i) => (
            <div className={`series-side ${t} ${leader === t ? "lead" : ""}`} key={t}>
              <TeamTag team={t} />
              <span className="series-team">{teamName(t)}</span>
              <span className="series-wins">
                <CountUp value={seriesScore[t]} />
              </span>
              {i === 0 && <span className="series-dash">–</span>}
            </div>
          ))}
        </div>
        <p className="series-caption">
          {leader
            ? `${teamName(leader)} ${pending ? "lead" : "win"} the series ${Math.max(seriesScore.nrv, seriesScore.vpn)}–${Math.min(seriesScore.nrv, seriesScore.vpn)}`
            : "Series level"}
        </p>
      </section>

      {/* Awards */}
      <section className="awards">
        {hero && (
          <article className="award hero" style={{ "--i": 0 }}>
            <Crown size={30} className="award-icon" />
            <span className="award-title">{hero.title}</span>
            <span className="award-player">
              <Avatar name={hero.name} size="lg" />
              <span>
                <b>{hero.name}</b>
                <span className="muted small">
                  <TeamTag team={hero.team} /> {teamName(hero.team)}
                </span>
              </span>
            </span>
            <span className="award-figure">{hero.figure}</span>
          </article>
        )}
        {rest.map((a, i) => {
          const Icon = AWARD_ICONS[a.id] || Award;
          return (
            <article className="award" key={a.id} style={{ "--i": i + 1 }}>
              <span className="award-title">
                <Icon size={16} /> {a.title}
              </span>
              <span className="award-name">
                {a.name} <TeamTag team={a.team} />
              </span>
              <span className="award-figure">{a.figure}</span>
            </article>
          );
        })}
      </section>

      <RunsChart matches={matches} />

      <h2 className="section-title">Recent matches</h2>
      <div className="match-list">
        {recent.map((m, i) => (
          <MatchCard m={m} index={i} key={m.id} />
        ))}
      </div>

      <h2 className="section-title">Series stats</h2>
      <div className="dash-grid">
        <SeriesTable
          title="Most runs"
          icon={<Zap size={18} />}
          rows={batters}
          cols={[
            ["Inn", (p) => p.inns],
            ["Runs", (p) => <b>{p.runs}</b>],
            ["HS", (p) => p.hsText],
            ["SR", (p) => p.sr.toFixed(1)],
            ["6s", (p) => p.sixes],
          ]}
        />
        <SeriesTable
          title="Most wickets"
          icon={<Target size={18} />}
          rows={bowlers}
          cols={[
            ["O", (p) => p.overs],
            ["W", (p) => <b>{p.wickets}</b>],
            ["BB", (p) => p.bestText],
            ["Econ", (p) => p.econ.toFixed(2)],
          ]}
        />
      </div>
    </div>
  );
}
