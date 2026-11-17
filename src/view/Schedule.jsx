import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CalendarPlus, ClipboardList, Clock, MapPin, Pencil, PlayCircle, Trash2, Trophy } from "lucide-react";
import FixtureForm from "../components/FixtureForm.jsx";
import { useFixtures } from "../context/FixturesContext.jsx";
import { blankFixture, computeResult, ensureInnings, inningsTotals, kickoff } from "../lib/scoring.js";
import { teamCode, teamName } from "../lib/series.js";
import { findTeam } from "../model/teams.js";

const STATUS = {
  scheduled: ["Upcoming", "up"],
  live: ["In progress", "live"],
  completed: ["Result", "done"],
  abandoned: ["No result", "nr"],
};

const TABS = [
  ["upcoming", "Upcoming", (f) => f.status === "scheduled"],
  ["live", "In progress", (f) => f.status === "live"],
  ["results", "Results", (f) => f.status === "completed" || f.status === "abandoned"],
];

const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function Crest({ team, size = "" }) {
  const t = findTeam(team);
  return (
    <span className={`fx-crest ${team} ${size}`} style={{ "--a1": t?.accent, "--a2": t?.accent2 }}>
      {t?.code || team}
    </span>
  );
}

const fmtDay = (fx) => {
  const d = kickoff(fx);
  return isNaN(d) ? { day: "—", mon: "", wd: "" } : {
    day: d.getDate(),
    mon: d.toLocaleDateString(undefined, { month: "short" }),
    wd: d.toLocaleDateString(undefined, { weekday: "short" }),
  };
};
const fmtTime = (fx) => {
  const d = kickoff(fx);
  return isNaN(d) ? "" : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

function Countdown({ fx }) {
  const now = useNow();
  const diff = kickoff(fx).getTime() - now;
  if (isNaN(diff)) return null;
  if (diff <= 0) return <p className="fx-count-note">{fx.status === "live" ? "Match in progress" : "Start time has passed: ready to score"}</p>;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return (
    <div className="fx-count" aria-label={`Starts in ${d} days ${h} hours ${m} minutes`}>
      {[
        [d, "days"],
        [h, "hrs"],
        [m, "min"],
      ].map(([v, l]) => (
        <span key={l}>
          <b>{String(v).padStart(2, "0")}</b>
          <small>{l}</small>
        </span>
      ))}
    </div>
  );
}

function ScoreLine({ fx }) {
  const inns = ensureInnings(fx);
  return (
    <span className="fx-scores">
      {inns.map((inn) => {
        const t = inningsTotals(inn);
        return (
          <span key={inn.team}>
            <b>{teamCode(inn.team)}</b> {t.started ? `${t.runs}/${t.wickets}` : "—"}
            {t.started && <small> ({t.overs})</small>}
          </span>
        );
      })}
    </span>
  );
}

function NextMatch({ fx, onEdit }) {
  return (
    <section className="score-strip fx-hero">
      <div className="score-strip-head">
        <span className="live-pill">
          <span className="live-dot" /> {fx.status === "live" ? "Live" : "Up next"}
        </span>
        <span className="score-strip-heading">
          {fx.title} · {fx.overs} overs
        </span>
      </div>
      <div className="fx-hero-body">
        <div className="fx-hero-team">
          <Crest team={fx.home} size="lg" />
          <span>{teamName(fx.home)}</span>
        </div>
        <div className="fx-hero-mid">
          <span className="fx-vs">VS</span>
          <Countdown fx={fx} />
          <p className="fx-hero-meta">
            <span>
              <CalendarClock size={15} />{" "}
              {kickoff(fx).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · {fmtTime(fx)}
            </span>
            {fx.venue && (
              <span>
                <MapPin size={15} /> {fx.venue}
              </span>
            )}
          </p>
        </div>
        <div className="fx-hero-team">
          <Crest team={fx.away} size="lg" />
          <span>{teamName(fx.away)}</span>
        </div>
      </div>
      <div className="fx-hero-actions">
        <Link to={`/schedule/${fx.id}/live`} className="btn primary">
          <PlayCircle size={18} /> {fx.status === "live" ? "Continue scoring" : "Start scoring"}
        </Link>
        <button className="btn ghost" onClick={onEdit}>
          <Pencil size={16} /> Edit
        </button>
      </div>
    </section>
  );
}

function FixtureCard({ fx, index, onEdit, onDelete }) {
  const { day, mon, wd } = fmtDay(fx);
  const [label, tone] = STATUS[fx.status] || STATUS.scheduled;
  const result = fx.status === "completed" || fx.status === "abandoned" ? computeResult(fx) : null;
  const played = fx.status !== "scheduled";
  return (
    <article className="card fx-card" style={{ "--i": index }}>
      <div className="fx-date">
        <small>{wd}</small>
        <b>{day}</b>
        <small>{mon}</small>
      </div>
      <div className="fx-main">
        <div className="fx-top">
          <span className="fx-title">{fx.title}</span>
          <span className={`fx-status ${tone}`}>
            {tone === "live" && <span className="live-dot" />}
            {label}
          </span>
        </div>
        <div className="fx-teams">
          <Crest team={fx.home} /> <b>{teamName(fx.home)}</b>
          <span className="muted">vs</span>
          <Crest team={fx.away} /> <b>{teamName(fx.away)}</b>
        </div>
        <div className="fx-meta">
          <span>
            <Clock size={14} /> {fmtTime(fx)}
          </span>
          {fx.venue && (
            <span>
              <MapPin size={14} /> {fx.venue}
            </span>
          )}
          <span>{fx.overs} overs</span>
        </div>
        {played && <ScoreLine fx={fx} />}
        {result && (
          <p className="fx-result">
            <Trophy size={14} /> {result.text}
          </p>
        )}
      </div>
      <div className="fx-actions">
        {fx.status === "completed" || fx.status === "abandoned" ? (
          <Link to={`/schedule/${fx.id}`} className="btn primary sm">
            <ClipboardList size={16} /> Scorecard
          </Link>
        ) : (
          <Link to={`/schedule/${fx.id}/live`} className="btn primary sm">
            <PlayCircle size={16} /> {fx.status === "live" ? "Continue" : "Score"}
          </Link>
        )}
        <button className="icon-btn" onClick={onEdit} aria-label={`Edit ${fx.title}`}>
          <Pencil size={16} />
        </button>
        <button className="icon-btn danger" onClick={onDelete} aria-label={`Delete ${fx.title}`}>
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

export default function Schedule() {
  const { fixtures, addFixture, updateFixture, deleteFixture, nextNo } = useFixtures();
  const [form, setForm] = useState(null); // { mode: "add" | "edit", fx }
  const [tab, setTab] = useState(() => (fixtures.some((f) => f.status === "live") ? "live" : "upcoming"));

  const sorted = [...fixtures].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const next = sorted.find((f) => f.status === "live") || sorted.find((f) => f.status === "scheduled");
  const [, , filter] = TABS.find(([id]) => id === tab);
  const list = sorted.filter(filter);
  if (tab === "results") list.reverse();

  const openAdd = () => setForm({ mode: "add", fx: blankFixture(nextNo(), { date: todayISO() }) });
  const remove = (fx) => {
    if (confirm(`Delete ${fx.title}${fx.status !== "scheduled" ? " and its scorecard" : ""}?`)) deleteFixture(fx.id);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Schedule</h1>
          <p className="muted">Plan fixtures, then enter the full scorecard for each game.</p>
        </div>
        <button className="btn primary" onClick={openAdd}>
          <CalendarPlus size={18} /> Schedule match
        </button>
      </header>

      {next && <NextMatch fx={next} onEdit={() => setForm({ mode: "edit", fx: next })} />}

      <div className="tabs" role="tablist" style={{ "--tab-i": TABS.findIndex(([id]) => id === tab), "--tab-n": TABS.length }}>
        <span className="tab-indicator" />
        {TABS.map(([id, label, f]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {label} <span className="tab-count">{fixtures.filter(f).length}</span>
          </button>
        ))}
      </div>

      <div className="fx-list" key={tab}>
        {list.length ? (
          list.map((fx, i) => (
            <FixtureCard key={fx.id} fx={fx} index={i} onEdit={() => setForm({ mode: "edit", fx })} onDelete={() => remove(fx)} />
          ))
        ) : (
          <div className="card empty">
            <p>
              {tab === "upcoming"
                ? "No upcoming matches."
                : tab === "live"
                  ? "No scorecards in progress. Open an upcoming match and press Score."
                  : "No results yet. Finished scorecards show up here and on the Matches page."}
            </p>
            {tab === "upcoming" && (
              <button className="btn primary" onClick={openAdd}>
                <CalendarPlus size={18} /> Schedule match
              </button>
            )}
          </div>
        )}
      </div>

      {form && (
        <FixtureForm
          title={form.mode === "add" ? "Schedule match" : `Edit ${form.fx.title}`}
          initial={form.fx}
          onClose={() => setForm(null)}
          onSubmit={(data) => {
            const fields = { title: data.title, date: data.date, time: data.time, venue: data.venue, overs: data.overs, home: data.home, away: data.away };
            if (form.mode === "add") {
              addFixture(fields);
              setTab("upcoming");
            } else {
              updateFixture(form.fx.id, (f) => {
                // A different pair of teams invalidates the XI/toss/innings (swapping home/away doesn't).
                const teamsChanged = [f.home, f.away].sort().join() !== [data.home, data.away].sort().join();
                return teamsChanged ? { ...fields, toss: { winner: "", decision: "bat" }, innings: [], potm: null } : fields;
              });
            }
            setForm(null);
          }}
        />
      )}
    </div>
  );
}
