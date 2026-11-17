import { Suspense, lazy, useState } from "react";
import { Shirt, X } from "lucide-react";
import { ROLES } from "../context/PlayersContext.jsx";
import { useStart } from "../context/StartContext.jsx";
import { TEAMS, findTeam } from "../model/teams.js";
import { BEARDS, BUILDS, GLASSES, HAIR_STYLES, HEADWEAR, lookFor } from "../replay/look.js";

// the character creator (three.js) is only loaded when opened
const CharacterCreator = lazy(() => import("./CharacterCreator.jsx"));

const label = (list, v) => list.find(([k]) => k === v)?.[1] || v;
// How the player looks in the 3D highlights video: a summary and the full character creator.
function LookEditor({ player, onChange, teamId }) {
  const [open, setOpen] = useState(false);
  const look = lookFor(player);
  const t = findTeam(teamId) || TEAMS[0];
  const kit = { shirt: t.accent, trousers: "#1f2937", trim: t.accent2, code: t.code, team: t.name };
  return (
    <div className="form-section look-section">
      <div className="look-summary">
        <span className="look-avatar" style={{ background: look.skin }} aria-hidden="true">
          <i style={{ background: look.hair === "bald" ? "transparent" : look.hairColor }} />
          <b style={{ background: kit.shirt, color: "#fff" }}>{player.jersey || "–"}</b>
        </span>
        <div className="look-summary-text">
          <strong>
            <Shirt size={15} /> 3D character
          </strong>
          <span>
            {[label(HAIR_STYLES, look.hair), label(BEARDS, look.beard), label(HEADWEAR, look.headwear), look.glasses !== "none" ? label(GLASSES, look.glasses) : "", label(BUILDS, look.build), `${look.height} cm`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        <button type="button" className="btn primary sm" onClick={() => setOpen(true)}>
          Customize character
        </button>
      </div>
      {open && (
        <Suspense fallback={<div className="cc-backdrop cc-loading">Loading the character creator…</div>}>
          <CharacterCreator
            name={player.name}
            jersey={player.jersey}
            look={player.look}
            kit={kit}
            onClose={() => setOpen(false)}
            onSave={({ look: l, jersey }) => {
              onChange(l, jersey);
              setOpen(false);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function PlayerForm({ initial, title, onSubmit, onClose, compact = false, validate, onDelete, teamId }) {
  const start = useStart();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Name is required");
    const data = { ...form, name: form.name.trim().replace(/\s+/g, " ") };
    const problem = validate?.(data);
    if (problem) return setError(problem);
    NUMERIC.forEach((k) => (data[k] = Math.max(0, Number(data[k]) || 0)));
    if (data.notOuts > data.innings) return setError("Not outs can't be more than innings");
    onSubmit(data);
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal card" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="grid-2">
          <label className="field span-2">
            Name
            <input autoFocus value={form.name} onChange={set("name")} placeholder="Player name" />
          </label>
          <label className="field">
            Role
            <select value={form.role} onChange={set("role")}>
              <option value="">Not set</option>
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Jersey #
            <input value={form.jersey} onChange={set("jersey")} placeholder="e.g. 18" />
          </label>
          <label className="field">
            Batting style
            <select value={form.battingStyle} onChange={set("battingStyle")}>
              <option value="">Not set</option>
              <option>Right-hand bat</option>
              <option>Left-hand bat</option>
            </select>
          </label>
          <label className="field">
            Bowling style
            <input
              value={form.bowlingStyle}
              onChange={set("bowlingStyle")}
              placeholder="e.g. Right-arm off spin"
            />
          </label>
        </div>

        <LookEditor player={form} teamId={teamId || start?.team?.id} onChange={(look, jersey) => setForm((f) => ({ ...f, look, jersey: jersey ?? f.jersey }))} />

        {!compact && SECTIONS.map((s) => (
          <fieldset className="form-section" key={s.title}>
            <legend>{s.title}</legend>
            <div className="grid-3">
              {s.fields.map(([key, label, type = "number", placeholder]) => (
                <label className="field" key={key}>
                  {label}
                  <input
                    type={type}
                    min={type === "number" ? "0" : undefined}
                    step={key === "overs" ? "0.1" : undefined}
                    value={form[key] ?? ""}
                    onChange={set(key)}
                    placeholder={placeholder}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          {onDelete && (
            <button type="button" className="btn danger" style={{ marginRight: "auto" }} onClick={onDelete}>
              Delete player
            </button>
          )}
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">Save</button>
        </div>
      </form>
    </div>
  );
}
