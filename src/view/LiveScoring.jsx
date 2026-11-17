import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowLeftRight, ClipboardList, Flag, ListOrdered, Mic, Pencil, PlayCircle, Repeat, Target, Undo2, UserPlus, Users, X } from "lucide-react";
import SquadPanel from "../components/SquadPanel.jsx";
import CommentaryFeed from "../components/CommentaryFeed.jsx";
import LiveWagon, { FieldPicker } from "../components/LiveWagon.jsx";
import { useFixtures, useSquads } from "../context/FixturesContext.jsx";
import { DISMISSALS, ensureInnings, inningsTotals, maxBowlerOvers, otherSide } from "../lib/scoring.js";
import { ballLabel, ballText, ballTone, blankLive, inningsOver, isLegal, replay, selAfter, syncInnings } from "../lib/live.js";
import { teamCode, teamName } from "../lib/series.js";
import { Setup } from "./ScoreEntry.jsx";

const WICKETS = ["b", "c", "cb", "lbw", "st", "ro", "hw", "rh"];
const EXTRA_OPTIONS = {
  wd: { title: "Wide", hint: "Runs taken on the wide (1 wide is added automatically)", runs: [0, 1, 2, 3, 4] },
  nb: { title: "No ball", hint: "Runs off the bat (1 no-ball is added automatically)", runs: [0, 1, 2, 3, 4, 6] },
  b: { title: "Byes", hint: "Runs taken", runs: [1, 2, 3, 4] },
  lb: { title: "Leg byes", hint: "Runs taken", runs: [1, 2, 3, 4] },
};
const sr = (r, b) => (b ? ((r / b) * 100).toFixed(1) : "0.0");

function Sheet({ title, onClose, children }) {
  return (
    <div className="lv-sheet-backdrop" onMouseDown={onClose}>
      <div className="lv-sheet" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="lv-sheet-head">
          <h3>{title}</h3>
          {onClose && (
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function Ball({ e, big }) {
  return (
    <span className={`lv-ball ${ballTone(e)} ${big ? "big" : ""}`} title={ballText(e)}>
      {ballLabel(e)}
    </span>
  );
}

function PlayerPick({ names, disabled = {}, sub = {}, onPick }) {
  return (
    <div className="lv-pick">
      {names.map((n) => (
        <button key={n} type="button" className="lv-pick-btn" disabled={!!disabled[n]} onClick={() => onPick(n)}>
          <b>{n}</b>
          {(disabled[n] || sub[n]) && <small>{disabled[n] || sub[n]}</small>}
        </button>
      ))}
      {!names.length && <p className="muted small">No players available.</p>}
    </div>
  );
}

function WicketSheet({ sel, fieldPool, onClose, onConfirm, freeHit = false }) {
  const [how, setHow] = useState("");
  const [out, setOut] = useState(sel.striker);
  const [fielder, setFielder] = useState("");
  const [runs, setRuns] = useState(0);
  const needF = how === "c" || how === "st" || how === "ro";
  const canPickOut = how === "ro" || how === "rh";
  const ok = how && (!needF || fielder || how === "ro");
  return (
    <Sheet title="Wicket" onClose={onClose}>
      {freeHit && <p className="lv-freehit-note">Free hit: the batter can only be run out.</p>}
      <span className="se-label">How out</span>
      <div className="lv-chips">
        {(freeHit ? WICKETS.filter((w) => w === "ro" || w === "rh") : WICKETS).map((w) => (
          <button key={w} type="button" className={`lv-chip ${how === w ? "on" : ""}`} onClick={() => { setHow(w); if (w !== "ro" && w !== "rh") setOut(sel.striker); }}>
            {DISMISSALS[w][0]}
          </button>
        ))}
      </div>
      {canPickOut && (
        <>
          <span className="se-label">Who is out?</span>
          <div className="lv-chips">
            {[sel.striker, sel.nonStriker].map((n, i) => (
              <button key={n} type="button" className={`lv-chip ${out === n ? "on" : ""}`} onClick={() => setOut(n)}>
                {n} <small>{i ? "non-striker" : "striker"}</small>
              </button>
            ))}
          </div>
        </>
      )}
      {how === "ro" && (
        <>
          <span className="se-label">Runs completed before the run out</span>
          <div className="lv-chips">
            {[0, 1, 2, 3].map((r) => (
              <button key={r} type="button" className={`lv-chip ${runs === r ? "on" : ""}`} onClick={() => setRuns(r)}>
                {r}
              </button>
            ))}
          </div>
        </>
      )}
      {needF && (
        <>
          <span className="se-label">{how === "st" ? "Wicket-keeper" : how === "ro" ? "Fielder (optional)" : "Caught by"}</span>
          <PlayerPick names={fieldPool} onPick={setFielder} sub={fielder ? { [fielder]: "selected" } : {}} />
        </>
      )}
      <button type="button" className="btn primary block lv-confirm danger-btn" disabled={!ok} onClick={() => onConfirm({ how, out, fielder: needF ? fielder : "", runs: how === "ro" ? runs : 0 })}>
        Confirm wicket
      </button>
    </Sheet>
  );
}

function Start({ fx, squads, patch }) {
  const hasManual = ensureInnings(fx).some((i) => inningsTotals(i).started);
  return (
    <div className="page">
      <Link to="/schedule" className="back-link">
        <ArrowLeft size={16} /> Schedule
      </Link>
      <header className="page-head">
        <div>
          <h1>Live scoring</h1>
          <p className="muted">
            {fx.title} · {teamName(fx.home)} vs {teamName(fx.away)} · {fx.overs} overs
          </p>
        </div>
      </header>
      <Setup fx={fx} squads={squads} patch={patch} />
      {hasManual && <p className="se-warn-note">This match already has a typed-in scorecard. Starting live scoring will replace it ball by ball.</p>}
      <button type="button" className="btn primary block" onClick={() => patch({ live: blankLive(), status: "live" })}>
        <PlayCircle size={20} /> Start live scoring
      </button>
    </div>
  );
}

export default function LiveScoring() {
  const { id } = useParams();
  const { getFixture, updateFixture } = useFixtures();
  const squads = useSquads();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState(null); // "wicket" | "wd" | "nb" | "b" | "lb" | "bowler" | { shot: partial }
  const [panel, setPanel] = useState("comm"); // comm | wagon | overs
  const [squadsOpen, setSquadsOpen] = useState(false); // add / edit players mid-match
  const [askShot, setAskShot] = useState(() => {
    try {
      return localStorage.getItem("playerinfo.askShot") !== "0";
    } catch {
      return true;
    }
  });
  const toggleShot = () =>
    setAskShot((v) => {
      try {
        localStorage.setItem("playerinfo.askShot", v ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !v;
    });
  const fx = getFixture(id);

  if (!fx) {
    return (
      <div className="page">
        <div className="empty card">
          <p>That match doesn't exist.</p>
          <Link to="/schedule" className="btn primary">Back to schedule</Link>
        </div>
      </div>
    );
  }
  const patch = (p) => updateFixture(fx.id, (f) => ({ ...f, ...(typeof p === "function" ? p(f) : p) }));
  if (!fx.live) return <Start fx={fx} squads={squads} patch={patch} />;

  const k = fx.live.inn;
  const sel = fx.live.sel[k];
  const r = replay(fx, k);
  const team = r.team;
  const fielding = otherSide(fx, team);
  const pool = (t) => (fx.xi?.[t]?.length ? fx.xi[t] : (squads[t] || []).map((p) => p.name));
  const batPool = pool(team);
  const fieldPool = pool(fielding);
  const first = k === 1 ? replay(fx, 0) : null;
  const target = first ? first.runs + 1 : null;
  const ballsLeft = Number(fx.overs) * 6 - r.legal;
  const crr = r.legal ? (r.runs / r.legal) * 6 : 0;
  const over = inningsOver(fx, k, r);
  const needBat = !over && (!sel.striker || !sel.nonStriker);
  const needBowler = !over && !needBat && !sel.bowler;
  const blocked = !!over || needBat || needBowler;
  const last = r.events[r.events.length - 1];

  // Apply a change to the live state, then rebuild the scorecard from the ball log.
  const commit = (mutate) =>
    updateFixture(fx.id, (f) => {
      const live = structuredClone(f.live);
      mutate(live, f);
      const next = { ...f, live };
      const inns = syncInnings(next).innings.map((inn, j) => (j <= live.inn ? (live.events[j].length ? inn : { ...inn, batting: [], bowling: [], extras: { b: "", lb: "", w: "", nb: "", p: "" } }) : inn));
      return { ...next, innings: inns, status: f.status === "scheduled" ? "live" : f.status };
    });

  const record = (partial) => {
    setSheet(null);
    commit((live, f) => {
      const s = live.sel[live.inn];
      const e = { runs: 0, extra: "", wicket: null, ...partial, striker: s.striker, nonStriker: s.nonStriker, bowler: s.bowler };
      live.events[live.inn].push(e);
      const legal = replay({ ...f, live }, live.inn).legal;
      live.sel[live.inn] = selAfter(e, legal);
    });
  };
  // Runs off the bat: optionally ask where the shot went (feeds commentary + live wagon wheel).
  const runs = (n, extra = "") => {
    if (askShot && n > 0) setSheet({ shot: { runs: n, extra } });
    else record({ runs: n, extra });
  };
  const leftHand = (name) => (squads[team] || []).find((p) => p.name === name)?.battingStyle?.startsWith("Left");
  const undo = () =>
    commit((live) => {
      if (!live.events[live.inn].length && live.inn === 1) live.inn = 0;
      const e = live.events[live.inn].pop();
      if (e) live.sel[live.inn] = { striker: e.striker, nonStriker: e.nonStriker, bowler: e.bowler };
    });
  const setSel = (p) => commit((live) => Object.assign(live.sel[live.inn], p));
  const nextInnings = () => commit((live) => { live.inn = 1; });
  const finish = () => navigate(`/schedule/${fx.id}/score`, { state: { step: 3 } });

  // Batters still available: not yet batted (or retired hurt), and not already at the crease.
  const usedBat = Object.fromEntries([...r.batters.values()].filter((b) => b.how !== "rh").map((b) => [b.name, b.how === "notout" ? "batted" : "out"]));
  const atCrease = [sel.striker, sel.nonStriker].filter(Boolean);
  const freshBatters = batPool.filter((n) => !usedBat[n] && !atCrease.includes(n));
  const perBowler = maxBowlerOvers(fx) * 6;
  const newOver = r.thisOver.balls.length === 0;
  const bowlerBlock = Object.fromEntries(
    fieldPool
      .map((n) => {
        const b = r.bowlers.get(n);
        if (b && b.balls >= perBowler) return [n, `${maxBowlerOvers(fx)} overs done`];
        if (newOver && n === r.lastOverBowler) return [n, "bowled last over"];
        return null;
      })
      .filter(Boolean)
  );
  const bowlerSub = Object.fromEntries([...r.bowlers.values()].map((b) => [b.name, `${Math.floor(b.balls / 6)}.${b.balls % 6}-${b.runs}-${b.wickets}`]));

  const batRow = (name, striker) => {
    const b = r.batters.get(name) || { runs: 0, balls: 0, fours: 0, sixes: 0 };
    return (
      <tr className={striker ? "on-strike" : ""} key={name || (striker ? "s" : "n")}>
        <td>
          <span className="lv-bat-name">
            {striker && <span className="lv-strike-dot" aria-label="on strike" />}
            {name || <span className="muted">—</span>}
            {striker && "*"}
          </span>
        </td>
        <td className="num lv-big">{b.runs}</td>
        <td className="num">{b.balls}</td>
        <td className="num">{b.fours}</td>
        <td className="num">{b.sixes}</td>
        <td className="num">{sr(b.runs, b.balls)}</td>
      </tr>
    );
  };
  const bw = r.bowlers.get(sel.bowler || r.thisOver.bowler || r.lastOverBowler);

  return (
    <div className="page lv">
      <div className="se-top">
        <Link to="/schedule" className="back-link">
          <ArrowLeft size={16} /> Schedule
        </Link>
        <span className="row lv-tools">
          <button type="button" className="btn ghost sm" onClick={() => setSquadsOpen(true)}>
            <Users size={15} /> Squads
          </button>
          <Link to={`/schedule/${fx.id}`} className="btn ghost sm">
            <ClipboardList size={15} /> Scorecard
          </Link>
          <Link to={`/schedule/${fx.id}/score`} className="btn ghost sm">
            <Pencil size={15} /> Edit
          </Link>
        </span>
      </div>

      <div className="lv-grid">
        <div className="lv-left">
          {/* Score header */}
          <section className="lv-score">
            <div className="lv-score-top">
              <span className={`team-tag ${team}`}>{teamCode(team)}</span>
              <span className="lv-team">{teamName(team)}</span>
              {r.freeHitNext && <span className="lv-freehit" title="After a no-ball: the batter can only be run out">FREE HIT</span>}
              <span className="lv-inn">{k === 0 ? "1st innings" : "2nd innings"}</span>
            </div>
            <div className="lv-score-main">
              <span className="lv-runs" key={`${r.runs}-${r.wickets}`}>
                {r.runs}
                <span>/{r.wickets}</span>
              </span>
              <span className="lv-overs">
                ({r.oversText}<small>/{fx.overs} ov</small>)
              </span>
              {last && (
                <span className={`lv-flash ${ballTone(last)}`} key={r.events.length}>
                  {ballText(last).split(" · ")[0]}
                </span>
              )}
            </div>
            <div className="lv-rates">
              <span>
                CRR <b>{crr.toFixed(2)}</b>
              </span>
              {target ? (
                <>
                  <span>
                    Target <b>{target}</b>
                  </span>
                  {target - r.runs > 0 && ballsLeft > 0 && (
                    <span>
                      RRR <b>{(((target - r.runs) / ballsLeft) * 6).toFixed(2)}</b>
                    </span>
                  )}
                </>
              ) : (
                <span>
                  Projected <b>{Math.round(crr * Number(fx.overs))}</b>
                </span>
              )}
              <span>
                Partnership <b>{r.partnership.runs}</b> ({r.partnership.balls})
              </span>
            </div>
            {target && (
              <p className="lv-equation">
                {r.runs >= target
                  ? `${teamName(team)} have reached the target`
                  : `${teamCode(team)} need ${target - r.runs} run${target - r.runs === 1 ? "" : "s"} from ${ballsLeft} ball${ballsLeft === 1 ? "" : "s"}`}
              </p>
            )}
            {!target && first === null && k === 0 && fx.toss?.winner && (
              <p className="lv-equation muted">
                {teamName(fx.toss.winner)} won the toss and chose to {fx.toss.decision}
              </p>
            )}
          </section>

          {/* Batters */}
          <section className="card lv-card">
            <table className="lv-table lv-bat-table">
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
                {batRow(sel.striker, true)}
                {batRow(sel.nonStriker, false)}
              </tbody>
            </table>
            <div className="lv-card-actions">
              <button type="button" className="btn ghost sm" disabled={!sel.striker || !sel.nonStriker} onClick={() => setSel({ striker: sel.nonStriker, nonStriker: sel.striker })}>
                <ArrowLeftRight size={15} /> Swap strike
              </button>
            </div>
          </section>

          {/* Bowler + this over */}
          <section className="card lv-card">
            <table className="lv-table">
              <thead>
                <tr>
                  <th>Bowler</th>
                  <th className="num">O</th>
                  <th className="num">M</th>
                  <th className="num">R</th>
                  <th className="num">W</th>
                  <th className="num">Econ</th>
                </tr>
              </thead>
              <tbody>
                <tr className="on-strike">
                  <td>
                    <span className="lv-bat-name">{sel.bowler || <span className="muted">New over: pick a bowler</span>}</span>
                  </td>
                  <td className="num">{bw ? `${Math.floor(bw.balls / 6)}.${bw.balls % 6}` : "0"}</td>
                  <td className="num">{bw?.maidens || 0}</td>
                  <td className="num">{bw?.runs || 0}</td>
                  <td className="num lv-big">{bw?.wickets || 0}</td>
                  <td className="num">{bw?.balls ? ((bw.runs / bw.balls) * 6).toFixed(2) : "0.00"}</td>
                </tr>
              </tbody>
            </table>
            <div className="lv-over">
              <span className="se-label">This over</span>
              <div className="lv-over-balls">
                {r.thisOver.balls.map((e) => (
                  <Ball e={e} key={e.idx} />
                ))}
                {Array.from({ length: Math.max(0, 6 - r.thisOver.balls.filter(isLegal).length) }, (_, i) => (
                  <span className="lv-ball empty" key={`e${i}`} />
                ))}
                <span className="lv-over-runs">{r.thisOver.runs} runs</span>
              </div>
            </div>
            <div className="lv-card-actions">
              <button type="button" className="btn ghost sm" disabled={!!over} onClick={() => setSheet("bowler")}>
                <Repeat size={15} /> Change bowler
              </button>
            </div>
          </section>
        </div>

        <div className="lv-right">
          {/* Keypad */}
          <section className={`lv-pad ${blocked ? "blocked" : ""}`} aria-label="Scoring keypad">
            <div className="lv-pad-runs">
              {[0, 1, 2, 3, 4, 6].map((n) => (
                <button key={n} type="button" className={`lv-key r${n}`} disabled={blocked} onClick={() => runs(n)}>
                  {n === 0 ? "•" : n}
                  <small>{n === 0 ? "dot" : n === 4 ? "four" : n === 6 ? "six" : n === 1 ? "run" : "runs"}</small>
                </button>
              ))}
            </div>
            <div className="lv-pad-extras">
              {["wd", "nb", "b", "lb"].map((x) => (
                <button key={x} type="button" className="lv-key x" disabled={blocked} onClick={() => setSheet(x)}>
                  {x === "b" ? "BYE" : x.toUpperCase()}
                </button>
              ))}
              <button type="button" className="lv-key x" disabled={blocked} onClick={() => runs(5)}>
                5
              </button>
            </div>
            <div className="lv-pad-actions">
              <button type="button" className="lv-key out" disabled={blocked} onClick={() => setSheet("wicket")}>
                OUT
              </button>
              <button type="button" className="lv-key undo" disabled={!r.events.length && k === 0} onClick={undo}>
                <Undo2 size={18} /> Undo
              </button>
            </div>
            <label className="lv-shot-toggle">
              <input type="checkbox" checked={askShot} onChange={toggleShot} /> Ask shot direction for runs (wagon wheel)
            </label>
            <button type="button" className="lv-end" onClick={() => (k === 0 ? confirm("End this innings now?") && nextInnings() : finish())}>
              <Flag size={14} /> {k === 0 ? "End innings" : "End match"}
            </button>
          </section>

          <div className="lv-tabs" role="tablist" aria-label="Match centre">
            {[
              ["comm", "Commentary", Mic],
              ["wagon", "Wagon wheel", Target],
              ["overs", "Overs", ListOrdered],
            ].map(([id, label, Icon]) => (
              <button key={id} type="button" role="tab" aria-selected={panel === id} className={panel === id ? "on" : ""} onClick={() => setPanel(id)}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {panel === "comm" && <CommentaryFeed r={r} limit={40} compact />}
          {panel === "wagon" && <LiveWagon events={r.events} title={`${teamCode(team)} wagon wheel`} batters={[sel.striker, sel.nonStriker]} />}
          {panel === "overs" && (
            <section className="card lv-card lv-timeline">
              {r.events.length === 0 && <p className="muted small">The first ball will appear here.</p>}
              <ol>
                {r.thisOver.balls.length > 0 && (
                  <li className="lv-ov current">
                    <span className="lv-ov-no">Ov {r.overs.length + 1}</span>
                    <span className="lv-ov-balls">
                      {r.thisOver.balls.map((e) => (
                        <Ball e={e} key={e.idx} />
                      ))}
                    </span>
                    <span className="lv-ov-sum">{r.thisOver.bowler}</span>
                  </li>
                )}
                {[...r.overs].reverse().map((o) => (
                  <li className="lv-ov" key={o.no}>
                    <span className="lv-ov-no">Ov {o.no}</span>
                    <span className="lv-ov-balls">
                      {o.balls.map((e) => (
                        <Ball e={e} key={e.idx} />
                      ))}
                    </span>
                    <span className="lv-ov-sum">
                      {o.bowler} · <b>{o.runs}</b> · {o.score.runs}/{o.score.wickets}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>

      {/* Prompts */}
      {over && (
        <Sheet title={`Innings complete · ${over}`}>
          <p className="lv-sheet-score">
            {teamName(team)} <b>{r.runs}/{r.wickets}</b> ({r.oversText} ov)
          </p>
          {k === 0 ? (
            <button type="button" className="btn primary block" onClick={nextInnings}>
              <PlayCircle size={18} /> Start {teamName(otherSide(fx, team))} innings · target {r.runs + 1}
            </button>
          ) : (
            <button type="button" className="btn primary block" onClick={finish}>
              <Flag size={18} /> Result & player of the match
            </button>
          )}
          <button type="button" className="btn ghost block" onClick={undo}>
            <Undo2 size={16} /> Undo last ball
          </button>
        </Sheet>
      )}
      {needBat && (
        <Sheet title={!sel.striker && !sel.nonStriker ? "Opening batters: pick the striker" : !sel.striker ? "New batter (on strike)" : "New batter (non-striker)"}>
          <PlayerPick names={freshBatters} onPick={(n) => setSel(!sel.striker ? { striker: n } : { nonStriker: n })} />
          <button type="button" className="btn ghost block" onClick={() => setSquadsOpen(true)}>
            <UserPlus size={16} /> Add / edit {teamCode(team)} players
          </button>
          {r.events.length > 0 && (
            <button type="button" className="btn ghost block" onClick={undo}>
              <Undo2 size={16} /> Undo last ball
            </button>
          )}
        </Sheet>
      )}
      {(needBowler || sheet === "bowler") && (
        <Sheet title={r.legal === 0 && newOver ? "Opening bowler" : newOver ? `Over ${r.overs.length + 1}: pick the bowler` : "Change bowler"} onClose={sheet === "bowler" ? () => setSheet(null) : undefined}>
          <PlayerPick
            names={fieldPool}
            disabled={newOver ? bowlerBlock : Object.fromEntries(Object.entries(bowlerBlock).filter(([, v]) => !v.includes("last")))}
            sub={bowlerSub}
            onPick={(n) => {
              setSheet(null);
              setSel({ bowler: n });
            }}
          />
          <button type="button" className="btn ghost block" onClick={() => setSquadsOpen(true)}>
            <UserPlus size={16} /> Add / edit {teamCode(fielding)} players
          </button>
          {needBowler && r.events.length > 0 && (
            <button type="button" className="btn ghost block" onClick={undo}>
              <Undo2 size={16} /> Undo last ball
            </button>
          )}
        </Sheet>
      )}
      {sheet?.shot && (
        <Sheet title={`${sheet.shot.extra === "nb" ? "No ball + " : ""}${sheet.shot.runs} run${sheet.shot.runs > 1 ? "s" : ""}: shot direction`} onClose={() => setSheet(null)}>
          <FieldPicker
            runs={sheet.shot.runs}
            batter={sel.striker}
            left={leftHand(sel.striker)}
            onPick={(shot) => record({ ...sheet.shot, shot })}
            onSkip={() => record(sheet.shot)}
          />
        </Sheet>
      )}
      {sheet === "wicket" && (
        <WicketSheet
          sel={sel}
          fieldPool={fieldPool}
          freeHit={r.freeHitNext}
          onClose={() => setSheet(null)}
          onConfirm={(w) => record({ runs: w.runs, wicket: { how: w.how, out: w.out, fielder: w.fielder } })}
        />
      )}
      {EXTRA_OPTIONS[sheet] && (
        <Sheet title={EXTRA_OPTIONS[sheet].title} onClose={() => setSheet(null)}>
          <span className="se-label">{EXTRA_OPTIONS[sheet].hint}</span>
          <div className="lv-pad-runs lv-extra-runs">
            {EXTRA_OPTIONS[sheet].runs.map((n) => (
              <button key={n} type="button" className="lv-key" onClick={() => (sheet === "nb" && n > 0 ? runs(n, "nb") : record({ runs: n, extra: sheet }))}>
                {sheet === "wd" ? (n ? `WD+${n}` : "WD") : sheet === "nb" ? (n ? `NB+${n}` : "NB") : n}
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {squadsOpen && (
        <div className="modal-backdrop squads-backdrop" onMouseDown={() => setSquadsOpen(false)}>
          <div className="modal card squads-modal" role="dialog" aria-modal="true" aria-label="Squads" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Squads & playing XI</h2>
              <button type="button" className="icon-btn" onClick={() => setSquadsOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p className="muted small">New player arrived? Add them here and they can bat or bowl straight away.</p>
            <div className="dash-grid">
              {[fx.home, fx.away].map((t) => (
                <SquadPanel key={t} fx={fx} team={t} squad={squads[t] || []} patch={patch} />
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn primary" onClick={() => setSquadsOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
