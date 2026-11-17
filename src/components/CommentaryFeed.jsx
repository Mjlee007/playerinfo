import { useState } from "react";
import { Mic } from "lucide-react";
import { commentLine, overSummary } from "../lib/commentary.js";
import { teamCode } from "../lib/series.js";

const FILTERS = [
  ["all", "All"],
  ["bound", "4s & 6s"],
  ["w", "Wickets"],
];

// Ball-by-ball commentary, newest first, with an end-of-over card after every completed over.
export default function CommentaryFeed({ r, limit, compact = false }) {
  const [filter, setFilter] = useState("all");
  const overEnd = new Map(r.overs.map((o) => [o.balls[o.balls.length - 1].idx, o]));
  const rows = [];
  for (const entry of [...r.log].reverse()) {
    const c = commentLine(entry);
    const keep = filter === "all" || (filter === "w" ? c.tone === "w" : c.tone === "four" || c.tone === "six");
    const o = overEnd.get(entry.idx);
    if (o && filter === "all") rows.push({ type: "over", o, key: `o${o.no}` });
    if (keep) rows.push({ type: "ball", entry, c, key: `b${entry.idx}` });
  }
  const shown = limit ? rows.slice(0, limit) : rows;

  return (
    <section className={`card cm ${compact ? "compact" : ""}`}>
      <div className="viz-head">
        <h3 className="card-title">
          <Mic size={18} /> Commentary
        </h3>
        <div className="cm-filter" role="tablist" aria-label="Filter commentary">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? "on" : ""} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 && <p className="muted small">{r.log.length ? "Nothing matches this filter yet." : "Commentary starts with the first ball."}</p>}
      <ol className="cm-list">
        {shown.map((row, i) =>
          row.type === "over" ? (
            <li className="cm-over" key={row.key}>
              <div className="cm-over-head">
                <b>End of over {row.o.no}</b>
                <span>{overSummary(row.o)}</span>
                <span className="cm-over-score">
                  {teamCode(r.team)} {row.o.score.runs}/{row.o.score.wickets}
                </span>
              </div>
              <div className="cm-over-body">
                {row.o.crease.filter((b) => !b.out).map((b) => (
                  <span key={b.name}>
                    {b.name} <b>{b.runs}</b> ({b.balls})
                  </span>
                ))}
                <span>
                  {row.o.figures.name} <b>{Math.floor(row.o.figures.balls / 6)}.{row.o.figures.balls % 6}-{row.o.figures.runs}-{row.o.figures.wickets}</b>
                </span>
              </div>
            </li>
          ) : (
            <li className={`cm-ball ${row.c.tone}`} key={row.key} style={{ "--i": Math.min(i, 10) }}>
              <span className="cm-no">{row.entry.over}</span>
              <span className={`cm-res ${row.c.tone}`}>{row.c.result}</span>
              <div className="cm-body">
                <span className="cm-head">
                  {row.c.head}
                  {row.c.zone && <small> · {row.c.zone}</small>}
                </span>
                <p>{row.c.text}</p>
                {row.c.milestones.map((m) => (
                  <p className="cm-milestone" key={m}>
                    {m}
                  </p>
                ))}
              </div>
            </li>
          )
        )}
      </ol>
    </section>
  );
}
