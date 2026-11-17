import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Award, CalendarDays, Coins, MapPin, Pencil, Printer, Trophy } from "lucide-react";
import Avatar from "../components/Avatar.jsx";
import CommentaryFeed from "../components/CommentaryFeed.jsx";
import LiveWagon from "../components/LiveWagon.jsx";
import { replay } from "../lib/live.js";
import { useFixtures, useSquads } from "../context/FixturesContext.jsx";
import {
  bowlerWickets, computeResult, dismissalText, ensureInnings, inningsTotals, isOut, kickoff, otherSide, oversBalls, suggestPotm,
} from "../lib/scoring.js";
import { teamCode, teamName } from "../lib/series.js";
import { fixtureHighlights } from "../lib/highlights.js";
import MatchHighlights, { useMatchMoments } from "../components/MatchHighlights.jsx";

const num = (v) => Math.max(0, Number(v) || 0);

function InningsCard({ fx, inn, squads }) {
  const t = inningsTotals(inn);
  const fielding = otherSide(fx, inn.team);
  const rows = inn.batting.filter((r) => r.name);
  const pool = fx.xi?.[inn.team]?.length ? fx.xi[inn.team] : (squads[inn.team] || []).map((p) => p.name);
  const dnb = pool.filter((n) => !rows.some((r) => r.name === n));
  const fow = rows
    .filter((r) => isOut(r) && r.fowRuns !== "" && r.fowRuns != null)
    .map((r) => ({ name: r.name, runs: num(r.fowRuns), over: r.fowOver }))
    .sort((a, b) => a.runs - b.runs);
  const e = inn.extras;
  const bowlers = inn.bowling.filter((b) => b.name);
  const topRuns = Math.max(0, ...rows.map((r) => num(r.runs)));
  const topW = Math.max(0, ...bowlers.map((b) => bowlerWickets(inn, b.name)));

  return (
    <section className="card table-wrap msc-innings">
      <header className="msc-inn-head">
        <span className={`team-tag ${inn.team}`}>{teamCode(inn.team)}</span>
        <h3>{teamName(inn.team)} innings</h3>
        <span className="msc-inn-score">
          {t.runs}/{t.wickets} <small>({t.overs} ov)</small>
        </span>
      </header>

      <table className="table sc-table msc-table">
        <thead>
          <tr>
            <th>Batter</th>
            <th className="num">R</th>
            <th className="num">B</th>
            <th className="num">4s</th>
            <th className="num">6s</th>
            <th className="num">SR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} className={`static ${num(r.runs) === topRuns && topRuns > 0 ? "top" : ""}`} style={{ "--i": i }}>
              <td>
                <span className="sc-player">
                  <Avatar name={r.name} size="sm" />
                  <span>
                    <span className="sc-name">
                      {r.name}
                      {!isOut(r) && <span className="msc-notout">*</span>}
                    </span>
                    <span className={`sc-sub ${isOut(r) ? "" : "msc-live"}`}>{dismissalText(r)}</span>
                  </span>
                </span>
              </td>
              <td className="num sc-main">{num(r.runs)}</td>
              <td className="num">{num(r.balls)}</td>
              <td className="num">{num(r.fours)}</td>
              <td className="num">{num(r.sixes)}</td>
              <td className="num">{num(r.balls) ? ((num(r.runs) / num(r.balls)) * 100).toFixed(2) : "—"}</td>
            </tr>
          ))}
          <tr className="static msc-extras">
            <td>
              Extras{" "}
              <span className="sc-sub msc-inline">
                (b {num(e.b)}, lb {num(e.lb)}, w {num(e.w)}, nb {num(e.nb)}
                {num(e.p) ? `, p ${num(e.p)}` : ""})
              </span>
            </td>
            <td className="num sc-main">{t.extras}</td>
            <td colSpan={4} />
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>
              Total <span className="sc-sub msc-inline">({t.wickets} wkts, {t.overs} ov, RR {t.rr.toFixed(2)})</span>
            </td>
            <td className="num sc-main">{t.runs}</td>
            <td colSpan={4} />
          </tr>
        </tfoot>
      </table>

      {dnb.length > 0 && (
        <p className="msc-line">
          <b>Did not bat:</b> {dnb.join(", ")}
        </p>
      )}
      {fow.length > 0 && (
        <p className="msc-line">
          <b>Fall of wickets:</b>{" "}
          {fow.map((f, i) => (
            <span key={f.name} className="msc-fow">
              {f.runs}-{i + 1} ({f.name}
              {f.over ? `, ${f.over} ov` : ""}){i < fow.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      )}

      {bowlers.length > 0 && (
        <table className="table sc-table msc-table msc-bowl">
          <thead>
            <tr>
              <th>{teamCode(fielding)} bowling</th>
              <th className="num">O</th>
              <th className="num">M</th>
              <th className="num">R</th>
              <th className="num">W</th>
              <th className="num">NB</th>
              <th className="num">WD</th>
              <th className="num">Econ</th>
            </tr>
          </thead>
          <tbody>
            {bowlers.map((b, i) => {
              const w = bowlerWickets(inn, b.name);
              const balls = oversBalls(b.overs);
              return (
                <tr key={b.name} className={`static ${w === topW && topW > 0 ? "top" : ""}`} style={{ "--i": i }}>
                  <td>
                    <span className="sc-player">
                      <Avatar name={b.name} size="sm" />
                      <span className="sc-name">{b.name}</span>
                    </span>
                  </td>
                  <td className="num">{b.overs || 0}</td>
                  <td className="num">{num(b.maidens)}</td>
                  <td className="num">{num(b.runs)}</td>
                  <td className="num sc-main">{w}</td>
                  <td className="num">{num(b.noBalls)}</td>
                  <td className="num">{num(b.wides)}</td>
                  <td className="num">{balls ? ((num(b.runs) / balls) * 6).toFixed(2) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function MatchScorecard() {
  const { id } = useParams();
  const { getFixture } = useFixtures();
  const squads = useSquads();
  const fx = getFixture(id);
  const [tab, setTab] = useState(0);
  const moments = useMatchMoments(id, fixtureHighlights(fx));

  if (!fx) {
    return (
      <div className="page">
        <div className="empty card">
          <p>That match doesn't exist.</p>
          <Link to="/schedule" className="btn primary">
            Back to schedule
          </Link>
        </div>
      </div>
    );
  }

  const innings = ensureInnings(fx);
  const result = computeResult(fx);
  const potm = fx.status === "abandoned" ? null : fx.potm || suggestPotm(fx);
  const when = kickoff(fx);
  const tossText = fx.toss?.winner ? `${teamName(fx.toss.winner)} won the toss and chose to ${fx.toss.decision === "bat" ? "bat" : "bowl"} first` : "Toss not recorded";

  return (
    <div className="page msc">
      <div className="se-top">
        <Link to="/schedule" className="back-link">
          <ArrowLeft size={16} /> Schedule
        </Link>
        <span className="row">
          <button className="btn ghost sm" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
          {fx.status !== "completed" && fx.status !== "abandoned" && (
            <Link to={`/schedule/${fx.id}/live`} className="btn primary sm">
              Live scoring
            </Link>
          )}
          <Link to={`/schedule/${fx.id}/score`} className="btn ghost sm">
            <Pencil size={16} /> Edit scorecard
          </Link>
        </span>
      </div>

      <section className="score-strip msc-hero">
        <div className="score-strip-head">
          <span className="live-pill">
            <span className="live-dot" /> {fx.status === "completed" ? "Result" : fx.status === "abandoned" ? "No result" : "In progress"}
          </span>
          <span className="score-strip-heading">
            {fx.title} · {fx.overs} overs
          </span>
        </div>
        <div className="msc-hero-teams">
          {innings.map((inn) => {
            const t = inningsTotals(inn);
            const won = result?.winner === inn.team;
            return (
              <div className={`msc-hero-team ${won ? "won" : result?.winner ? "lost" : ""}`} key={inn.team}>
                <span className={`team-tag ${inn.team}`}>{teamCode(inn.team)}</span>
                <span className="msc-hero-name">{teamName(inn.team)}</span>
                <span className="msc-hero-score">
                  {t.started ? (
                    <>
                      {t.runs}/{t.wickets}
                      <small>({t.overs} ov)</small>
                    </>
                  ) : (
                    <small>Did not bat</small>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        <p className="msc-result">
          <Trophy size={16} /> {result?.text || "Result pending"}
        </p>
        <div className="msc-meta">
          {!isNaN(when) && (
            <span>
              <CalendarDays size={14} /> {when.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
          {fx.venue && (
            <span>
              <MapPin size={14} /> {fx.venue}
            </span>
          )}
          <span>
            <Coins size={14} /> {tossText}
          </span>
          {potm && (
            <span className="msc-potm">
              <Award size={14} /> Player of the match: <b>{potm.name}</b> <span className={`team-tag ${potm.team}`}>{teamCode(potm.team)}</span>
            </span>
          )}
        </div>
      </section>

      {fx.status !== "abandoned" && (
        <MatchHighlights matchId={fx.id} moments={moments} teams={[fx.home, fx.away]} playerTitle={`${fx.title} · ${teamCode(fx.home)} v ${teamCode(fx.away)}`} live={fx.status === "live"} title={fx.status === "completed" ? "Match highlights" : "Highlights"} date={fx.date} time={fx.time} venue={fx.venue} />
      )}

      <div className="tabs msc-tabs" role="tablist" style={{ "--tab-i": tab, "--tab-n": innings.length }}>
        <span className="tab-indicator" />
        {innings.map((inn, i) => (
          <button key={inn.team} role="tab" aria-selected={tab === i} className={tab === i ? "active" : ""} onClick={() => setTab(i)}>
            {teamName(inn.team)}
          </button>
        ))}
      </div>

      {/* Screen: one innings at a time. Print: both. */}
      {innings.map((inn, i) => (
        <div key={inn.team} className={`msc-pane ${tab === i ? "on" : ""}`}>
          <InningsCard fx={fx} inn={inn} squads={squads} />
          {fx.live?.events?.[i]?.length > 0 && (
            <div className="msc-live">
              <CommentaryFeed r={replay(fx, i)} />
              <LiveWagon events={fx.live.events[i]} title={`${teamCode(inn.team)} wagon wheel`} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
