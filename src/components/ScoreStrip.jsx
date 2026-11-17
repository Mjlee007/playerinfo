import CountUp from "./CountUp.jsx";

// Scoreboard-style banner: one or more "innings" panels with a big score line and rate chips.
// panel = { title, score, wickets?, sep?, overs?, extra?, chips: [[label, value, decimals?]] }
export default function ScoreStrip({ tag = "Season", heading, panels, children }) {
  return (
    <section className="score-strip">
      <div className="score-strip-head">
        <span className="live-pill">
          <span className="live-dot" /> {tag}
        </span>
        {heading && <span className="score-strip-heading">{heading}</span>}
      </div>
      <div className="score-panels">
        {panels.map((p) => (
          <div className="score-panel" key={p.title}>
            <div className="score-panel-title">{p.title}</div>
            <div className="score-line">
              <span className="score-big">
                <CountUp value={p.score} />
                {p.wickets !== undefined && (
                  <>
                    <span className="score-sep">{p.sep ?? "/"}</span>
                    <CountUp value={p.wickets} />
                  </>
                )}
              </span>
              {p.overs !== undefined && <span className="score-overs">({p.overs} ov)</span>}
              {p.extra && <span className="score-overs">{p.extra}</span>}
            </div>
            <div className="score-chips">
              {p.chips.map(([label, value, decimals = 0]) => (
                <span className="chip" key={label}>
                  <span>{label}</span>
                  <strong>{typeof value === "number" ? <CountUp value={value} decimals={decimals} /> : value}</strong>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {children}
    </section>
  );
}
