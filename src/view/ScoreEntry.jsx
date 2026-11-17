import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Award, CheckCircle2, Coins, Flag, PlayCircle, Plus, Save, Sparkles, Target, Trash2, X, Zap,
} from "lucide-react";
import { useFixtures, useSquads } from "../context/FixturesContext.jsx";
import {
  DISMISSALS, blankBatter, blankBowler, bowlerWickets, computeResult, dismissalText, ensureInnings, extrasTotal,
  inningsTotals, isOut, matchImpact, maxBowlerOvers, maxWickets, otherSide, oversBalls, validateInnings,
} from "../lib/scoring.js";
import { teamCode, teamName } from "../lib/series.js";
import SquadPanel from "../components/SquadPanel.jsx";

const num = (v) => Math.max(0, Number(v) || 0);
const sr = (r) => (num(r.balls) ? ((num(r.runs) / num(r.balls)) * 100).toFixed(1) : "—");
const econ = (b) => (oversBalls(b.overs) ? ((num(b.runs) / oversBalls(b.overs)) * 6).toFixed(2) : "—");

function NumIn({ value, onChange, label, wide, cap, ...rest }) {
  const input = (
    <input
      className={`se-in ${wide ? "wide" : ""}`}
      type="number"
      inputMode="numeric"
      min="0"
      aria-label={label}
      placeholder="0"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => e.target.select()}
      {...rest}
    />
  );
  // cap: short caption shown above the box when rows stack on small screens.
  return cap ? (
    <label className="se-num">
      <small>{cap}</small>
      {input}
    </label>
  ) : (
    input
  );
}

function NameSelect({ value, options, onChange, label, taken = [], placeholder = "Select" }) {
  return (
    <select className="se-sel" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o} disabled={o !== value && taken.includes(o)}>
          {o}
        </option>
      ))}
    </select>
  );
}

// ---------- Live score summary at the top ----------
function LiveStrip({ fx }) {
  const inns = ensureInnings(fx);
  const [a, b] = inns.map(inningsTotals);
  const target = a.started ? a.runs + 1 : null;
  const need = target && b.started ? target - b.runs : null;
  const ballsLeft = num(fx.overs) * 6 - b.balls;
  const res = computeResult(fx);
  return (
    <section className="score-strip se-strip">
      <div className="score-strip-head">
        <span className="live-pill">
          <span className="live-dot" /> Scoring
        </span>
        <span className="score-strip-heading">
          {fx.title} · {fx.overs} overs{fx.venue ? ` · ${fx.venue}` : ""}
        </span>
      </div>
      <div className="se-strip-body">
        {inns.map((inn, i) => {
          const t = i ? b : a;
          return (
            <div className="se-strip-team" key={inn.team}>
              <span className={`team-tag ${inn.team}`}>{teamCode(inn.team)}</span>
              <span className="se-strip-name">{teamName(inn.team)}</span>
              <span className="se-strip-score">
                {t.started ? `${t.runs}/${t.wickets}` : "Yet to bat"}
                {t.started && <small>({t.overs} ov · RR {t.rr.toFixed(2)})</small>}
              </span>
            </div>
          );
        })}
      </div>
      <p className="se-strip-note">
        {res
          ? res.text + (fx.status === "completed" ? "" : " (if the scorecard is final)")
          : need != null && need > 0
            ? `${teamName(inns[1].team)} need ${need} run${need === 1 ? "" : "s"}${ballsLeft > 0 ? ` from ${ballsLeft} ball${ballsLeft === 1 ? "" : "s"}` : ""}`
            : target
              ? `Target ${target}`
              : "Enter the first innings to set a target"}
      </p>
    </section>
  );
}

// ---------- Step 1: toss + playing XI ----------
export function Setup({ fx, squads, patch }) {
  const teams = [fx.home, fx.away];
  return (
    <div className="se-setup">
      <section className="card">
        <h3 className="card-title">
          <Coins size={18} /> Toss
        </h3>
        <div className="se-toss">
          <div>
            <span className="se-label">Won by</span>
            <div className="segmented">
              {teams.map((t) => (
                <button key={t} type="button" className={fx.toss?.winner === t ? "active" : ""} onClick={() => patch({ toss: { ...fx.toss, winner: t } })}>
                  {teamName(t)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="se-label">Elected to</span>
            <div className="segmented">
              {["bat", "bowl"].map((d) => (
                <button key={d} type="button" className={fx.toss?.decision === d ? "active" : ""} onClick={() => patch({ toss: { ...fx.toss, decision: d } })}>
                  {d === "bat" ? "Bat first" : "Bowl first"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="muted small">
          {fx.toss?.winner
            ? `${teamName(fx.toss.winner)} won the toss and chose to ${fx.toss.decision}. ${teamName(ensureInnings(fx)[0].team)} bat first.`
            : `No toss recorded: ${teamName(fx.home)} will bat first.`}
        </p>
      </section>

      <div className="dash-grid">
        {teams.map((t) => (
          <SquadPanel key={t} fx={fx} team={t} squad={squads[t] || []} patch={patch} />
        ))}
      </div>
    </div>
  );
}

// ---------- Step 2/3: one innings ----------
function InningsEditor({ fx, inn, squads, onChange }) {
  const team = inn.team;
  const fielding = otherSide(fx, team);
  const pool = (t) => (fx.xi?.[t]?.length ? fx.xi[t] : (squads[t] || []).map((p) => p.name));
  const batPool = pool(team);
  const fieldPool = pool(fielding);
  const t = inningsTotals(inn);
  const warnings = validateInnings(fx, inn);
  const batNames = inn.batting.map((r) => r.name).filter(Boolean);
  const bowlNames = inn.bowling.map((b) => b.name).filter(Boolean);
  const dnb = batPool.filter((n) => !batNames.includes(n));

  const setBat = (i, patch) => onChange({ ...inn, batting: inn.batting.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  const setBowl = (i, patch) => onChange({ ...inn, bowling: inn.bowling.map((b, k) => (k === i ? { ...b, ...patch } : b)) });
  const setExtra = (k, v) => onChange({ ...inn, extras: { ...inn.extras, [k]: v } });

  const addBatter = () => onChange({ ...inn, batting: [...inn.batting, { ...blankBatter(), name: dnb[0] || "" }] });
  const addBowler = () => {
    const free = fieldPool.filter((n) => !bowlNames.includes(n));
    // Bowlers usually come from the bottom of the order.
    onChange({ ...inn, bowling: [...inn.bowling, { ...blankBowler(), name: free[free.length - 1] || "" }] });
  };
  // Bowlers credited in dismissals but not yet in the bowling card.
  const missingBowlers = [...new Set(inn.batting.filter((r) => r.bowler && DISMISSALS[r.how]?.[2]).map((r) => r.bowler))].filter((n) => !bowlNames.includes(n));

  return (
    <div className="se-innings">
      <section className="card se-section">
        <h3 className="card-title">
          <Zap size={18} /> {teamName(team)} batting
        </h3>
        {inn.batting.length > 0 && (
          <div className="se-grid se-bat se-head" aria-hidden="true">
            <span>#</span>
            <span>Batter</span>
            <span>Dismissal</span>
            <span className="num">R</span>
            <span className="num">B</span>
            <span className="num">4s</span>
            <span className="num">6s</span>
            <span className="num">SR</span>
            <span />
          </div>
        )}
        {inn.batting.map((r, i) => {
          const [, needF, needB] = DISMISSALS[r.how] || [];
          return (
            <div className={`se-grid se-bat se-row ${isOut(r) ? "out" : ""}`} key={i} style={{ "--i": i }}>
              <span className="se-no">{i + 1}</span>
              <span className="se-cell-name">
                <NameSelect label={`Batter ${i + 1}`} value={r.name} options={batPool} taken={batNames} onChange={(v) => setBat(i, { name: v })} />
              </span>
              <span className="se-how">
                <select className="se-sel" aria-label="How out" value={r.how} onChange={(e) => setBat(i, { how: e.target.value })}>
                  {Object.entries(DISMISSALS).map(([k, [label]]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
                {needF && (
                  <NameSelect label="Fielder" placeholder={r.how === "st" ? "Keeper" : "Fielder"} value={r.fielder} options={fieldPool} onChange={(v) => setBat(i, { fielder: v })} />
                )}
                {needB && <NameSelect label="Bowler" placeholder="Bowler" value={r.bowler} options={fieldPool} onChange={(v) => setBat(i, { bowler: v })} />}
                {isOut(r) && (
                  <span className="se-fow" title="Fall of wicket (optional)">
                    <span>FoW</span>
                    <NumIn label="Score at fall of wicket" value={r.fowRuns} onChange={(v) => setBat(i, { fowRuns: v })} />
                    <input className="se-in" inputMode="decimal" placeholder="ov" aria-label="Over at fall of wicket" value={r.fowOver} onChange={(e) => setBat(i, { fowOver: e.target.value })} />
                  </span>
                )}
                <small className="se-dis-text">{r.name ? dismissalText(r) : ""}</small>
              </span>
              <NumIn cap="R" label="Runs" value={r.runs} onChange={(v) => setBat(i, { runs: v })} />
              <NumIn cap="B" label="Balls" value={r.balls} onChange={(v) => setBat(i, { balls: v })} />
              <NumIn cap="4s" label="Fours" value={r.fours} onChange={(v) => setBat(i, { fours: v })} />
              <NumIn cap="6s" label="Sixes" value={r.sixes} onChange={(v) => setBat(i, { sixes: v })} />
              <span className="num se-calc" data-label="SR">{sr(r)}</span>
              <button type="button" className="icon-btn danger se-del" aria-label={`Remove batter ${i + 1}`} onClick={() => onChange({ ...inn, batting: inn.batting.filter((_, k) => k !== i) })}>
                <X size={16} />
              </button>
            </div>
          );
        })}
        <div className="se-add-row">
          <button type="button" className="btn ghost sm" onClick={addBatter} disabled={inn.batting.length >= batPool.length}>
            <Plus size={16} /> Add batter
          </button>
          {dnb.length > 0 && inn.batting.length > 0 && (
            <span className="muted small">
              Did not bat: {dnb.join(", ")}
            </span>
          )}
        </div>

        <div className="se-extras">
          <span className="se-label">Extras</span>
          {[
            ["b", "Byes"],
            ["lb", "Leg byes"],
            ["w", "Wides"],
            ["nb", "No balls"],
            ["p", "Penalty"],
          ].map(([k, label]) => (
            <label key={k} className="se-extra">
              <small>{label}</small>
              <NumIn label={label} value={inn.extras[k]} onChange={(v) => setExtra(k, v)} />
            </label>
          ))}
          <span className="se-extra-total">
            = <b>{extrasTotal(inn.extras)}</b>
          </span>
        </div>
      </section>

      <section className="card se-section">
        <h3 className="card-title">
          <Target size={18} /> {teamName(fielding)} bowling
          <span className="muted small se-title-note">max {maxBowlerOvers(fx)} overs each · wickets fill in from dismissals</span>
        </h3>
        {inn.bowling.length > 0 && (
          <div className="se-grid se-bowl se-head" aria-hidden="true">
            <span>Bowler</span>
            <span className="num">O</span>
            <span className="num">M</span>
            <span className="num">R</span>
            <span className="num">Wd</span>
            <span className="num">Nb</span>
            <span className="num">W</span>
            <span className="num">Econ</span>
            <span />
          </div>
        )}
        {inn.bowling.map((b, i) => (
          <div className="se-grid se-bowl se-row" key={i} style={{ "--i": i }}>
            <span className="se-cell-name">
              <NameSelect label={`Bowler ${i + 1}`} value={b.name} options={fieldPool} taken={bowlNames} onChange={(v) => setBowl(i, { name: v })} />
            </span>
            <label className="se-num">
              <small>O</small>
              <input className="se-in" inputMode="decimal" placeholder="0.0" aria-label="Overs" value={b.overs} onChange={(e) => setBowl(i, { overs: e.target.value })} onFocus={(e) => e.target.select()} />
            </label>
            <NumIn cap="M" label="Maidens" value={b.maidens} onChange={(v) => setBowl(i, { maidens: v })} />
            <NumIn cap="R" label="Runs conceded" value={b.runs} onChange={(v) => setBowl(i, { runs: v })} />
            <NumIn cap="Wd" label="Wides" value={b.wides} onChange={(v) => setBowl(i, { wides: v })} />
            <NumIn cap="Nb" label="No balls" value={b.noBalls} onChange={(v) => setBowl(i, { noBalls: v })} />
            <span className="num se-calc strong" data-label="W">{b.name ? bowlerWickets(inn, b.name) : 0}</span>
            <span className="num se-calc" data-label="Econ">{econ(b)}</span>
            <button type="button" className="icon-btn danger se-del" aria-label={`Remove bowler ${i + 1}`} onClick={() => onChange({ ...inn, bowling: inn.bowling.filter((_, k) => k !== i) })}>
              <X size={16} />
            </button>
          </div>
        ))}
        <div className="se-add-row">
          <button type="button" className="btn ghost sm" onClick={addBowler} disabled={inn.bowling.length >= fieldPool.length}>
            <Plus size={16} /> Add bowler
          </button>
          {missingBowlers.map((n) => (
            <button
              type="button"
              key={n}
              className="btn ghost sm"
              onClick={() => onChange({ ...inn, bowling: [...inn.bowling, { ...blankBowler(), name: n }] })}
            >
              <Plus size={14} /> {n}
            </button>
          ))}
        </div>
      </section>

      <section className={`se-total ${warnings.length ? "warn" : "ok"}`}>
        <div className="se-total-line">
          <span>Total</span>
          <b>
            {t.runs}/{t.wickets}
          </b>
          <small>
            ({t.overs} of {fx.overs} ov · RR {t.rr.toFixed(2)} · {maxWickets(fx, team) - t.wickets} wkts in hand)
          </small>
        </div>
        {warnings.length ? (
          <ul className="se-warnings">
            {warnings.map((w) => (
              <li key={w}>
                <AlertTriangle size={14} /> {w}
              </li>
            ))}
          </ul>
        ) : (
          t.started && (
            <p className="se-ok">
              <CheckCircle2 size={15} /> Batting, extras and bowling figures add up.
            </p>
          )
        )}
      </section>
    </div>
  );
}

// ---------- Step 4: result + player of the match ----------
function ResultStep({ fx, patch, onFinish }) {
  const result = computeResult({ ...fx, status: fx.status === "abandoned" ? "abandoned" : "completed" });
  const impact = matchImpact(fx);
  const everyone = [fx.home, fx.away].flatMap((t) =>
    [...new Set([...(fx.xi?.[t] || []), ...ensureInnings(fx).flatMap((i) => [...i.batting.map((r) => (i.team === t ? r.name : "")), ...i.bowling.map((b) => (i.team !== t ? b.name : ""))])])]
      .filter(Boolean)
      .map((name) => ({ team: t, name }))
  );
  const potmKey = fx.potm ? `${fx.potm.team}|${fx.potm.name}` : "";
  const abandoned = fx.status === "abandoned";
  const warnings = ensureInnings(fx).flatMap((inn) => validateInnings(fx, inn));

  return (
    <div className="se-result">
      <section className="card">
        <h3 className="card-title">
          <Flag size={18} /> Result
        </h3>
        <div className="segmented">
          <button type="button" className={!abandoned ? "active" : ""} onClick={() => patch((f) => ({ status: f.status === "abandoned" ? "live" : f.status }))}>
            Played
          </button>
          <button type="button" className={abandoned ? "active" : ""} onClick={() => patch({ status: "abandoned" })}>
            No result / abandoned
          </button>
        </div>
        <p className="se-result-text">
          {result ? (
            <>
              <Sparkles size={18} /> {result.text}
            </>
          ) : (
            <span className="muted">Enter both innings to work out the result.</span>
          )}
        </p>
        {warnings.length > 0 && !abandoned && (
          <p className="se-warn-note">
            <AlertTriangle size={14} /> {warnings.length} scorecard check{warnings.length === 1 ? "" : "s"} still flagged. You can finish anyway.
          </p>
        )}
      </section>

      {!abandoned && (
        <section className="card">
          <h3 className="card-title">
            <Award size={18} /> Player of the match
          </h3>
          <label className="field">
            Choose player
            <select
              value={potmKey}
              onChange={(e) => {
                const v = e.target.value;
                patch({ potm: v ? { team: v.split("|")[0], name: v.slice(v.indexOf("|") + 1) } : null });
              }}
            >
              <option value="">Auto: top performer</option>
              {[fx.home, fx.away].map((t) => (
                <optgroup key={t} label={teamName(t)}>
                  {everyone
                    .filter((p) => p.team === t)
                    .map((p) => (
                      <option key={p.name} value={`${t}|${p.name}`}>
                        {p.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          {impact.length > 0 && (
            <div className="se-suggest">
              <span className="se-label">Top performers</span>
              {impact.slice(0, 4).map((p) => (
                <button
                  key={`${p.team}|${p.name}`}
                  type="button"
                  className={`se-suggest-chip ${potmKey === `${p.team}|${p.name}` ? "on" : ""}`}
                  onClick={() => patch({ potm: { team: p.team, name: p.name } })}
                >
                  <span className={`team-tag ${p.team}`}>{teamCode(p.team)}</span> {p.name}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <button type="button" className="btn primary block" disabled={!abandoned && !result} onClick={onFinish}>
        <CheckCircle2 size={20} /> {fx.status === "completed" ? "Save scorecard" : "Finish match & publish"}
      </button>
    </div>
  );
}

export default function ScoreEntry() {
  const { id } = useParams();
  const { getFixture, updateFixture } = useFixtures();
  const squads = useSquads();
  const navigate = useNavigate();
  const fx = getFixture(id);
  const location = useLocation();
  const [step, setStep] = useState(() => location.state?.step ?? 0);

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

  // Every change saves straight away; entering any score moves a fixture to "in progress".
  const patch = (p) =>
    updateFixture(fx.id, (f) => {
      const next = { ...f, ...(typeof p === "function" ? p(f) : p) };
      const started = ensureInnings(next).some((i) => inningsTotals(i).started);
      if (next.status === "scheduled" && started) next.status = "live";
      return next;
    });

  const innings = ensureInnings(fx);
  const setInnings = (k, inn) => patch((f) => ({ innings: ensureInnings(f).map((x, j) => (j === k ? inn : x)) }));
  const steps = [
    ["Setup", <Coins size={16} key="i" />],
    [`${teamCode(innings[0].team)} innings`, <Zap size={16} key="i" />],
    [`${teamCode(innings[1].team)} innings`, <Zap size={16} key="i" />],
    ["Result", <Flag size={16} key="i" />],
  ];

  const finish = () => {
    patch((f) => ({ status: f.status === "abandoned" ? "abandoned" : "completed" }));
    navigate(`/schedule/${fx.id}`);
  };

  return (
    <div className="page">
      <div className="se-top">
        <Link to="/schedule" className="back-link">
          <ArrowLeft size={16} /> Schedule
        </Link>
        <span className="row lv-tools">
          <span className="se-saved">
            <Save size={14} /> Saved automatically
          </span>
          {fx.status !== "completed" && fx.status !== "abandoned" && (
            <Link to={`/schedule/${fx.id}/live`} className="btn primary sm">
              <PlayCircle size={15} /> Ball-by-ball
            </Link>
          )}
        </span>
      </div>

      <LiveStrip fx={fx} />

      <nav className="se-steps" aria-label="Scorecard steps">
        {steps.map(([label, icon], i) => (
          <button key={label} type="button" className={`${step === i ? "active" : ""} ${i < step ? "done" : ""}`} aria-current={step === i ? "step" : undefined} onClick={() => setStep(i)}>
            <span className="se-step-no">{i + 1}</span>
            {icon}
            <span className="se-step-label">{label}</span>
          </button>
        ))}
      </nav>

      <div key={step} className="se-body">
        {step === 0 && <Setup fx={fx} squads={squads} patch={patch} />}
        {(step === 1 || step === 2) && fx.live?.events?.[step - 1]?.length > 0 && (
          <p className="se-warn-note">
            <AlertTriangle size={14} /> This innings is scored ball by ball. Changes here are replaced when the next ball is recorded in live scoring.
          </p>
        )}
        {(step === 1 || step === 2) && (
          <InningsEditor fx={fx} inn={innings[step - 1]} squads={squads} onChange={(inn) => setInnings(step - 1, inn)} />
        )}
        {step === 3 && <ResultStep fx={fx} patch={patch} onFinish={finish} />}
      </div>

      <div className="se-nav">
        <button type="button" className="btn ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft size={16} /> Back
        </button>
        {step < 3 && (
          <button type="button" className="btn primary" onClick={() => setStep((s) => s + 1)}>
            Next: {steps[step + 1][0]} <ArrowRight size={16} />
          </button>
        )}
      </div>
      {fx.status !== "scheduled" && (
        <p className="muted small se-danger-note">
          <Trash2 size={13} /> To delete this scorecard, use the bin icon on the Schedule page.
        </p>
      )}
    </div>
  );
}
