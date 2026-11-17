import { useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, UserPlus, Users } from "lucide-react";
import PlayerForm from "./PlayerForm.jsx";
import { blankPlayer, usePlayers } from "../context/PlayersContext.jsx";
import { renamePlayerInFixture } from "../lib/scoring.js";
import { teamName } from "../lib/series.js";

// One team's squad for a match: pick the playing XI (in batting order) and
// add / edit / delete players on the spot — e.g. a new player turns up for this match.
export default function SquadPanel({ fx, team, squad, patch }) {
  const { addTeamPlayer, updateTeamPlayer, deleteTeamPlayer } = usePlayers();
  const [editing, setEditing] = useState(null); // null | "new" | player
  const xi = fx.xi?.[team] || [];

  const setXi = (fn) => patch((f) => ({ xi: { ...f.xi, [team]: fn(f.xi?.[team] || []) } }));
  const toggle = (name) => setXi((cur) => (cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]));

  const validate = (data) => {
    const clash = squad.some((p) => p.id !== editing?.id && p.name.toLowerCase() === data.name.toLowerCase());
    return clash ? `${teamName(team)} already has a player called ${data.name}.` : "";
  };

  const save = (data) => {
    if (editing === "new") {
      addTeamPlayer(team, data);
      // Picking an XI already? Put the newcomer straight into it (always during live play,
      // so they show up in the batter/bowler pickers right away).
      if (xi.length && (xi.length < 11 || fx.status === "live")) setXi((cur) => [...cur, data.name]);
    } else {
      updateTeamPlayer(team, editing.id, data);
      if (data.name !== editing.name) patch((f) => renamePlayerInFixture(f, team, editing.name, data.name));
    }
    setEditing(null);
  };

  const remove = () => {
    const p = editing;
    const played = (fx.innings || []).some(
      (inn) => inn.batting.some((r) => [r.name, r.fielder, r.bowler].includes(p.name)) || inn.bowling.some((b) => b.name === p.name)
    ) || (fx.live?.events || []).flat().some((e) => [e.striker, e.nonStriker, e.bowler, e.wicket?.fielder].includes(p.name));
    const msg = played
      ? `Delete ${p.name} from ${teamName(team)}?\n\nThey already appear in this match's scorecard; those entries are kept.`
      : `Delete ${p.name} from ${teamName(team)}?`;
    if (!window.confirm(msg)) return;
    deleteTeamPlayer(team, p.id);
    setXi((cur) => cur.filter((n) => n !== p.name));
    setEditing(null);
  };

  return (
    <section className="card">
      <h3 className="card-title">
        <Users size={18} /> {teamName(team)} XI
        <span className={`se-xi-count ${xi.length === 11 ? "ok" : ""}`}>{xi.length}/11</span>
      </h3>
      <div className="se-xi">
        {squad.map((p) => {
          const on = xi.includes(p.name);
          return (
            <div className="se-xi-item" key={p.id}>
              <button type="button" className={`se-xi-chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggle(p.name)}>
                <span className="se-xi-no">{on ? xi.indexOf(p.name) + 1 : "+"}</span>
                <span>
                  {p.name}
                  <small>{p.role || "—"}</small>
                </span>
              </button>
              <button type="button" className="se-xi-edit" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`} title={`Edit or delete ${p.name}`}>
                <Pencil size={13} />
              </button>
            </div>
          );
        })}
        <button type="button" className="se-xi-chip se-xi-add" onClick={() => setEditing("new")}>
          <span className="se-xi-no">
            <UserPlus size={13} />
          </span>
          <span>
            Add player
            <small>New to the squad</small>
          </span>
        </button>
      </div>
      <div className="row se-xi-actions">
        <button type="button" className="btn ghost sm" onClick={() => setXi(() => squad.slice(0, 11).map((p) => p.name))}>
          First 11
        </button>
        <button type="button" className="btn ghost sm" onClick={() => setXi(() => [])}>
          Clear
        </button>
      </div>
      <p className="muted small">Tap players in batting order. If you skip this, the whole squad is offered. Use ✎ to edit or delete a player.</p>

      {editing &&
        createPortal(
          // Portal: always above cards and live-scoring sheets. Stop mouse-downs here so they
          // don't also close a dialog this panel sits in.
          <div className="stack-top" onMouseDown={(e) => e.stopPropagation()}>
            <PlayerForm
              compact
              teamId={team}
              title={editing === "new" ? `Add player · ${teamName(team)}` : `Edit ${editing.name}`}
              initial={editing === "new" ? blankPlayer : editing}
              validate={validate}
              onSubmit={save}
              onDelete={editing === "new" ? undefined : remove}
              onClose={() => setEditing(null)}
            />
          </div>,
          document.body
        )}
    </section>
  );
}
