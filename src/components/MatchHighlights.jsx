import { Suspense, lazy, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Frown, Hand, Laugh, Medal, Play, PlayCircle, Plus, Sparkles, Star, Target, Trash2, Trophy, Video } from "lucide-react";
import { clipKey, useClipKeys } from "../lib/videoClips.js";
import VideoClipDialog from "./VideoClipDialog.jsx";

// The 3D player (three.js) is loaded only when someone presses play.
const HighlightPlayer = lazy(() => import("./HighlightPlayer.jsx"));
import { FILTERS, KINDS } from "../lib/highlights.js";
import { addMoment, deleteMoment, momentsFor, useAllMoments } from "../lib/moments.js";
import { teamCode } from "../lib/series.js";

const ICON = {
  result: <Trophy size={16} />,
  star: <Star size={16} />,
  milestone: <Medal size={16} />,
  wicket: <Target size={16} />,
  six: <b>6</b>,
  four: <b>4</b>,
  funny: <Laugh size={16} />,
  catch: <Hand size={16} />,
  drop: <Frown size={16} />,
  noball: <b className="mh-txt">NB</b>,
  freehit: <b className="mh-txt">FH</b>,
  wide: <b className="mh-txt">WD</b>,
  other: <Sparkles size={16} />,
};
const ADD_KINDS = ["funny", "catch", "drop", "other"];
const overNum = (m) => (m.over === undefined || m.over === "" ? Infinity : parseFloat(m.over) || 0);

// Result first, then innings by innings in over order. Moments without an over keep their order.
export const orderMoments = (list) =>
  list
    .map((m, i) => ({ m, i }))
    .sort((a, b) =>
      (a.m.kind === "result" ? -1 : 0) - (b.m.kind === "result" ? -1 : 0) ||
      (a.m.inn ?? 9) - (b.m.inn ?? 9) ||
      overNum(a.m) - overNum(b.m) ||
      a.i - b.i
    )
    .map((x) => x.m);

// Moments merged with the ones people added by hand for this match.
export function useMatchMoments(matchId, auto) {
  const all = useAllMoments();
  return orderMoments([...auto, ...momentsFor(all, matchId)]);
}

function AddMoment({ matchId, teams, onDone }) {
  const [form, setForm] = useState({ kind: "funny", team: "", inn: "", over: "", text: "" });
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    const text = form.text.trim();
    if (!text) return setError("Describe what happened.");
    addMoment(matchId, {
      kind: form.kind,
      title: KINDS[form.kind],
      text,
      team: form.team || undefined,
      inn: form.inn === "" ? undefined : Number(form.inn),
      over: form.over.trim() || undefined,
    });
    onDone();
  };
  return (
    <form className="mh-add" onSubmit={submit}>
      <div className="cm-filter" role="radiogroup" aria-label="Kind of moment">
        {ADD_KINDS.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={form.kind === k} className={form.kind === k ? "on" : ""} onClick={() => setForm((f) => ({ ...f, kind: k }))}>
            {KINDS[k]}
          </button>
        ))}
      </div>
      <label className="field">
        What happened?
        <textarea
          autoFocus
          rows={2}
          value={form.text}
          onChange={set("text")}
          placeholder={form.kind === "funny" ? "e.g. Dog ran onto the pitch and stole the ball" : form.kind === "drop" ? "e.g. Ravi dropped a sitter at mid-on" : "e.g. One-handed screamer at long-on"}
        />
      </label>
      <div className="grid-3">
        {teams?.length > 0 && (
          <label className="field">
            Team
            <select value={form.team} onChange={set("team")}>
              <option value="">—</option>
              {teams.map((t) => (
                <option key={t} value={t}>{teamCode(t)}</option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          Innings
          <select value={form.inn} onChange={set("inn")}>
            <option value="">—</option>
            <option value="0">1st</option>
            <option value="1">2nd</option>
          </select>
        </label>
        <label className="field">
          Over
          <input value={form.over} onChange={set("over")} placeholder="e.g. 14.3" inputMode="decimal" />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row mh-add-actions">
        <button type="button" className="btn ghost sm" onClick={onDone}>Cancel</button>
        <button className="btn primary sm">Save moment</button>
      </div>
    </form>
  );
}

// A dismissal as on a professional scorecard: batter, how out, runs (balls), boundaries, SR, FoW.
export function WicketLine({ card }) {
  return (
    <div className="wk-line" aria-label={`${card.batter} ${card.how} ${card.runs} off ${card.balls} balls`}>
      <span className="wk-name">{card.batter}</span>
      <span className="wk-how">{card.how}</span>
      <span className="wk-score">
        <b>{card.runs}</b>
        <small>({card.balls})</small>
      </span>
      <span className="wk-stats">
        4s <b>{card.fours}</b> · 6s <b>{card.sixes}</b> · SR <b>{card.sr.toFixed(1)}</b>
      </span>
      {card.fow && (
        <span className="wk-fow">
          FoW {card.fow}
          {card.over ? ` (${card.over} ov)` : ""}
        </span>
      )}
    </div>
  );
}

// Highlights reel for one match: filters, the moments, and "Add a moment".
// compact: no filters / adding, shows `limit` items and a link to the full list.
export default function MatchHighlights({ matchId, moments, teams, title = "Match highlights", compact = false, limit, moreTo, live = false, playerTitle, date, time, venue }) {
  const [filter, setFilter] = useState("all");
  const [playFrom, setPlayFrom] = useState(null); // index into `shown` while the 3D video is open
  const [adding, setAdding] = useState(false);
  const [videoFor, setVideoFor] = useState(null); // moment whose match video is being edited
  const clipKeys = useClipKeys();
  const test = FILTERS.find((f) => f[0] === filter)?.[2] || (() => true);
  // moments with real footage carry its storage key: the video plays them from the clip
  const shown = (compact ? moments : moments.filter(test))
    .slice(0, limit || undefined)
    .map((m) => {
      const k = clipKey(matchId, m);
      return clipKeys.has(k) ? { ...m, videoKey: k } : m;
    });
  const videos = shown.filter((m) => m.videoKey).length;
  const count = (id) => moments.filter(FILTERS.find((f) => f[0] === id)[2]).length;

  return (
    <section className={`card mh ${compact ? "compact" : ""}`}>
      <div className="viz-head">
        <h3 className="card-title">
          <Sparkles size={18} /> {title}
          {live && <span className="mh-live"><span className="live-dot" /> so far</span>}
        </h3>
        {shown.length > 0 && (
          <button type="button" className="btn primary sm mh-play" onClick={() => setPlayFrom(0)}>
            <PlayCircle size={16} /> {compact ? "Play" : "Play highlights"}
          </button>
        )}
        {!compact && (
          <div className="cm-filter" role="tablist" aria-label="Filter highlights">
            {FILTERS.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? "on" : ""} onClick={() => setFilter(id)}>
                {label} <small>{count(id)}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      {shown.length === 0 && (
        <p className="muted small">{moments.length ? "Nothing in this filter." : "No highlights yet. They appear as the match is scored, or add your own moment."}</p>
      )}
      <ol className="mh-list">
        {shown.map((m, i) => (
          <li key={m.id} className={`mh-item ${m.kind}`} style={{ "--i": Math.min(i, 12) }}>
            <button type="button" className={`mh-badge ${m.kind}`} onClick={() => setPlayFrom(i)} aria-label={`Play: ${m.title}`} title="Play this moment">
              <span className="mh-badge-icon">{ICON[m.kind] || ICON.other}</span>
              <Play size={14} className="mh-badge-play" />
            </button>
            <div className="mh-body">
              <span className="mh-head">
                <b>{m.title}</b>
                {(m.over || m.team) && (
                  <small>
                    {m.team && teamCode(m.team)}
                    {m.team && m.over ? " · " : ""}
                    {m.over && `ov ${m.over}`}
                  </small>
                )}
                {m.custom && <small className="mh-tag">added</small>}
                {m.videoKey && (
                  <small className="mh-tag mh-video-tag">
                    <Video size={11} /> video
                  </small>
                )}
              </span>
              {m.card && <WicketLine card={m.card} />}
              {m.text && <p>{m.card ? m.text.replace(/^.*?\(\d+\)\.\s*/, "") : m.text}</p>}
            </div>
            {matchId && !compact && (
              <button type="button" className={`icon-btn mh-vid ${m.videoKey ? "on" : ""}`} onClick={() => setVideoFor(m)} aria-label={m.videoKey ? `Edit the match video for: ${m.title}` : `Add a match video for: ${m.title}`} title={m.videoKey ? "Edit match video" : "Add match video (your own footage)"}>
                <Video size={15} />
              </button>
            )}
            {m.custom && !compact && (
              <button type="button" className="icon-btn mh-del" onClick={() => window.confirm("Delete this moment?") && deleteMoment(matchId, m.id)} aria-label="Delete moment">
                <Trash2 size={15} />
              </button>
            )}
          </li>
        ))}
      </ol>

      {compact && moreTo && moments.length > shown.length && (
        <Link to={moreTo} className="link-more">
          All {moments.length} highlights <ArrowRight size={15} />
        </Link>
      )}
      {!compact && matchId && (adding ? (
        <AddMoment matchId={matchId} teams={teams} onDone={() => setAdding(false)} />
      ) : (
        <button type="button" className="btn ghost sm mh-add-btn" onClick={() => setAdding(true)}>
          <Plus size={15} /> Add a moment <small className="muted">funny moment, great catch, drop…</small>
        </button>
      ))}
      {!compact && matchId && shown.length > 0 && (
        <p className="muted small mh-video-note">
          <Video size={13} /> {videos ? `${videos} highlight${videos === 1 ? "" : "s"} with your own match video.` : "Have phone videos of this match? Add them to highlights with the camera button and the video plays your real footage."}
        </p>
      )}
      {videoFor && <VideoClipDialog matchId={matchId} moment={videoFor} onClose={() => setVideoFor(null)} />}
      {playFrom !== null && (
        <Suspense fallback={<div className="hp-backdrop hp-loading">Loading 3D replay…</div>}>
          <HighlightPlayer moments={shown} start={playFrom} teams={teams || []} title={playerTitle || title} date={date} time={time} venue={venue} onClose={() => setPlayFrom(null)} />
        </Suspense>
      )}
    </section>
  );
}
