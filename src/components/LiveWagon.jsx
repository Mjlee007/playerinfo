import { useMemo, useRef, useState } from "react";
import { Table2, Target } from "lucide-react";
import { ZONES } from "../lib/wagon.js";
import { zoneFor } from "../lib/commentary.js";

const SIZE = 360;
const C = SIZE / 2;
const R = 132;
const INNER = 64;
const pt = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
};
const typeOf = (runs) => (runs === 6 ? "s3" : runs === 4 ? "s2" : "s1");
// Zone label angle as drawn: for a left-hander the field is mirrored.
const drawAngle = (deg, left) => (left ? 360 - deg : deg);

function FieldBase({ left, labels = true }) {
  return (
    <>
      <circle cx={C} cy={C} r={R} className="w-field" />
      <circle cx={C} cy={C} r={INNER} className="w-ring" />
      {ZONES.map((z) => {
        const [x, y] = pt(z.from, R);
        return <line key={z.id} x1={C} y1={C} x2={x} y2={y} className="w-divider" />;
      })}
      <rect x={C - 5} y={C - 26} width={10} height={30} rx={2} className="w-pitch" />
      {labels &&
        ZONES.map((z) => {
          const [lx, ly] = pt(drawAngle((z.from + z.to) / 2, left), R + 18);
          return (
            <text key={z.id} x={lx} y={ly} className="w-label" textAnchor="middle" dominantBaseline="middle">
              {z.name}
            </text>
          );
        })}
    </>
  );
}

// Tap where the ball went. Returns { a, d, left } (angle clockwise from straight, distance 0–1).
export function FieldPicker({ runs, left, batter, onPick, onSkip }) {
  const svg = useRef(null);
  const [hover, setHover] = useState(null);
  const toShot = (ev) => {
    const box = svg.current.getBoundingClientRect();
    const x = ((ev.clientX - box.left) / box.width) * SIZE - C;
    const y = ((ev.clientY - box.top) / box.height) * SIZE - C;
    const a = ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
    const d = Math.min(1, Math.hypot(x, y) / R);
    return { a: Math.round(a), d: Math.round(d * 100) / 100, left: !!left };
  };
  const hz = hover && zoneFor(hover);
  const [hx, hy] = hover ? pt(hover.a, Math.max(0.15, hover.d) * R) : [0, 0];
  return (
    <div className="lw-picker">
      <p className="muted small">
        Tap where <b>{batter}</b> hit the {runs === 6 ? "six" : runs === 4 ? "four" : `${runs}`}
        {left ? " (left-hander: field mirrored)" : ""}.
      </p>
      <svg
        ref={svg}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="lw-pick-svg"
        role="img"
        aria-label="Cricket field: tap the shot direction"
        onPointerMove={(e) => setHover(toShot(e))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => onPick(toShot(e))}
      >
        <FieldBase left={left} />
        {hover && (
          <>
            <line x1={C} y1={C - 4} x2={hx} y2={hy} className={`w-shot ${typeOf(runs)} on lw-preview`} />
            <circle cx={hx} cy={hy} r={6} className="lw-dot" />
          </>
        )}
      </svg>
      <div className="lw-pick-foot">
        <span className="lw-zone">{hz ? hz.name : "Point at the field"}</span>
        <button type="button" className="btn ghost sm" onClick={onSkip}>
          Skip direction
        </button>
      </div>
    </div>
  );
}

// Live wagon wheel from real tapped shots. events: replayed ball events with `shot`.
export default function LiveWagon({ events, title = "Wagon wheel", batters = [] }) {
  const [who, setWho] = useState("all");
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState(null);
  const shots = useMemo(
    () =>
      events
        .filter((e) => e.shot && !e.wicket && (e.extra === "" || e.extra === "nb") && e.runs > 0)
        .filter((e) => who === "all" || e.striker === who),
    [events, who]
  );
  const zones = ZONES.map((z) => {
    const list = shots.filter((s) => zoneFor(s.shot)?.id === z.id);
    return { ...z, runs: list.reduce((t, s) => t + s.runs, 0), fours: list.filter((s) => s.runs === 4).length, sixes: list.filter((s) => s.runs === 6).length, n: list.length };
  });
  const total = zones.reduce((t, z) => t + z.runs, 0);
  const names = [...new Set(events.filter((e) => e.shot).map((e) => e.striker))];
  const counts = { s1: shots.filter((s) => s.runs < 4).reduce((t, s) => t + s.runs, 0), s2: shots.filter((s) => s.runs === 4).length, s3: shots.filter((s) => s.runs === 6).length };
  const hz = hover && zones.find((z) => z.id === hover);

  return (
    <section className="card viz wagon lw">
      <div className="viz-head">
        <h3 className="card-title">
          <Target size={18} /> {title}
        </h3>
        <button className="viz-toggle" onClick={() => setTable((t) => !t)} aria-pressed={table}>
          <Table2 size={14} /> {table ? "Chart" : "Table"}
        </button>
      </div>
      {names.length > 1 && (
        <div className="lw-filter" role="tablist" aria-label="Filter by batter">
          {["all", ...names].map((n) => (
            <button key={n} type="button" role="tab" aria-selected={who === n} className={who === n ? "on" : ""} onClick={() => setWho(n)}>
              {n === "all" ? "All batters" : n}
              {batters.includes(n) && <i className="lw-live" aria-label="at the crease" />}
            </button>
          ))}
        </div>
      )}
      {shots.length === 0 ? (
        <p className="muted small viz-empty">No shots plotted yet. Tap a direction when you record runs.</p>
      ) : table ? (
        <table className="viz-table">
          <thead>
            <tr>
              <th>Zone</th>
              <th className="num">Runs</th>
              <th className="num">%</th>
              <th className="num">4s</th>
              <th className="num">6s</th>
            </tr>
          </thead>
          <tbody>
            {[...zones].sort((a, b) => b.runs - a.runs).map((z) => (
              <tr key={z.id}>
                <td>{z.name}</td>
                <td className="num">{z.runs}</td>
                <td className="num">{total ? Math.round((z.runs / total) * 100) : 0}%</td>
                <td className="num">{z.fours}</td>
                <td className="num">{z.sixes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <div className="viz-legend" role="list">
            {[
              ["s1", "1s–3s", `${counts.s1} runs`],
              ["s2", "4s", counts.s2],
              ["s3", "6s", counts.s3],
            ].map(([cls, label, n]) => (
              <span role="listitem" key={cls}>
                <i className={`key-line ${cls}`} /> {label} <b>{n}</b>
              </span>
            ))}
          </div>
          <div className="wagon-plot" onMouseLeave={() => setHover(null)}>
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`${title}: ${total} runs from ${shots.length} plotted shots`}>
              <FieldBase />
              <g className={`w-shots ${hover ? "dim" : ""}`}>
                {shots.map((s, i) => {
                  const [x, y] = pt(s.shot.left ? 360 - s.shot.a : s.shot.a, Math.max(0.2, s.runs >= 4 ? Math.max(s.shot.d, 0.92) : s.shot.d) * R);
                  const z = zoneFor(s.shot);
                  return (
                    <line
                      key={i}
                      x1={C}
                      y1={C - 4}
                      x2={x}
                      y2={y}
                      className={`w-shot ${typeOf(s.runs)} ${hover && z?.id === hover ? "on" : ""} ${i === shots.length - 1 ? "latest" : ""}`}
                      style={{ "--d": `${Math.min(i, 60) * 12}ms` }}
                    />
                  );
                })}
              </g>
              {zones.map((z) => {
                // Hit area follows the zone as drawn (labels are not mirrored in the summary chart).
                const [x1, y1] = pt(z.from, R + 6);
                const [x2, y2] = pt(z.to, R + 6);
                return (
                  <path
                    key={z.id}
                    d={`M${C},${C} L${x1},${y1} A${R + 6},${R + 6} 0 0 1 ${x2},${y2} Z`}
                    className={`w-hit ${hover === z.id ? "on" : ""}`}
                    onMouseEnter={() => setHover(z.id)}
                  />
                );
              })}
            </svg>
            {hz && (
              <div className="viz-tip lw-tip">
                <strong>{hz.name}</strong>
                <span>
                  {hz.runs} runs · {total ? Math.round((hz.runs / total) * 100) : 0}%
                </span>
                <span>
                  {hz.fours} fours · {hz.sixes} sixes
                </span>
              </div>
            )}
          </div>
        </>
      )}
      <p className="viz-note">Plotted live from the scorer's taps · viewed from behind a right-handed batter (left-handers' shots are mirrored to match).</p>
    </section>
  );
}
