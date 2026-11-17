import { useMemo, useRef, useState } from "react";
import { Table2, Target } from "lucide-react";
import { buildWagon } from "../lib/wagon.js";

const SIZE = 360;
const C = SIZE / 2;
const R = 128; // boundary rope
const INNER = 60; // 30-yard circle

const pt = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
};
const wedge = (from, to, r) => {
  const [x1, y1] = pt(from, r);
  const [x2, y2] = pt(to, r);
  return `M${C},${C} L${x1},${y1} A${r},${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2},${y2} Z`;
};

const TYPES = [
  { id: "other", label: "1s–3s", cls: "s1" },
  { id: "four", label: "4s", cls: "s2" },
  { id: "six", label: "6s", cls: "s3" },
];

export default function WagonWheel({ player, teamId, title = "Scoring wheel", compact = false }) {
  const data = useMemo(() => buildWagon(player, teamId), [player, teamId]);
  const [hover, setHover] = useState(null); // { zone, x, y }
  const [table, setTable] = useState(false);
  const wrap = useRef(null);

  const zoneOf = (id) => data.zones.find((z) => z.id === id);
  const onMove = (z) => (e) => {
    const box = wrap.current.getBoundingClientRect();
    setHover({ zone: z.id, x: e.clientX - box.left, y: e.clientY - box.top });
  };
  const hz = hover && zoneOf(hover.zone);
  const shotCount = { other: Math.round(data.otherRuns / 1.35), four: data.fours, six: data.sixes };

  return (
    <section className={`card viz wagon ${compact ? "compact" : ""}`}>
      <div className="viz-head">
        <h3 className="card-title">
          <Target size={18} /> {title}
        </h3>
        <button className="viz-toggle" onClick={() => setTable((t) => !t)} aria-pressed={table}>
          <Table2 size={14} /> {table ? "Chart" : "Table"}
        </button>
      </div>

      {data.runs === 0 ? (
        <p className="muted small viz-empty">No runs recorded yet.</p>
      ) : table ? (
        <table className="viz-table">
          <thead>
            <tr>
              <th>Zone</th>
              <th className="num">Runs</th>
              <th className="num">%</th>
              <th className="num">1s–3s</th>
              <th className="num">4s</th>
              <th className="num">6s</th>
            </tr>
          </thead>
          <tbody>
            {[...data.zones].sort((a, b) => b.runs - a.runs).map((z) => (
              <tr key={z.id}>
                <td>{z.name}</td>
                <td className="num">{z.runs}</td>
                <td className="num">{((z.runs / data.runs) * 100).toFixed(0)}%</td>
                <td className="num">{z.other}</td>
                <td className="num">{z.fours}</td>
                <td className="num">{z.sixes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <div className="viz-legend" role="list">
            {TYPES.map((t) => (
              <span role="listitem" key={t.id}>
                <i className={`key-line ${t.cls}`} /> {t.label}
                <b>{t.id === "other" ? `${data.otherRuns} runs` : shotCount[t.id]}</b>
              </span>
            ))}
          </div>

          <div className="wagon-plot" ref={wrap} onMouseLeave={() => setHover(null)}>
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`${title}: ${data.runs} runs, ${data.fours} fours, ${data.sixes} sixes`}>
              <circle cx={C} cy={C} r={R} className="w-field" />
              <circle cx={C} cy={C} r={INNER} className="w-ring" />
              {data.zones.map((z) => {
                const [x, y] = pt(z.from, R);
                return <line key={z.id} x1={C} y1={C} x2={x} y2={y} className="w-divider" />;
              })}
              <rect x={C - 5} y={C - 26} width={10} height={30} rx={2} className="w-pitch" />

              <g className={`w-shots ${hover ? "dim" : ""}`}>
                {data.shots.map((s, i) => {
                  const [x, y] = pt(s.angle, s.len * R);
                  const cls = TYPES.find((t) => t.id === s.type).cls;
                  return (
                    <line
                      key={i}
                      x1={C}
                      y1={C - 4}
                      x2={x}
                      y2={y}
                      className={`w-shot ${cls} ${hover?.zone === s.zone ? "on" : ""}`}
                      style={{ "--d": `${Math.min(i, 120) * 6}ms` }}
                    />
                  );
                })}
              </g>

              {data.zones.map((z) => {
                const mid = (z.from + z.to) / 2;
                const [lx, ly] = pt(mid, R + 18);
                return (
                  <g key={z.id}>
                    <path
                      d={wedge(z.from, z.to, R + 6)}
                      className={`w-hit ${hover?.zone === z.id ? "on" : ""}`}
                      onMouseMove={onMove(z)}
                      onMouseEnter={onMove(z)}
                    />
                    <text x={lx} y={ly} className="w-label" textAnchor="middle" dominantBaseline="middle">
                      {z.name}
                    </text>
                  </g>
                );
              })}
            </svg>

            {hz && (
              <div className="viz-tip" style={{ left: hover.x, top: hover.y }}>
                <strong>{hz.name}</strong>
                <span>
                  {hz.runs} runs · {((hz.runs / data.runs) * 100).toFixed(0)}%
                </span>
                <span>
                  <i className="key-dot s2" /> {hz.fours} fours <i className="key-dot s3" /> {hz.sixes} sixes
                </span>
              </div>
            )}
          </div>
        </>
      )}

      <p className="viz-note">
        {data.left ? "Left-hander" : "Right-hander"} · viewed from behind the batter. Illustrative: shot directions are
        generated from career totals{data.sampled ? "; a sample of shots is drawn" : ""}.
      </p>
    </section>
  );
}
