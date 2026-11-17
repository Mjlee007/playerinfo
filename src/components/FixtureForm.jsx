import { useState } from "react";
import { X } from "lucide-react";
import { TEAMS } from "../model/teams.js";

const OVER_PRESETS = [5, 6, 8, 10, 12, 15, 20, 50];

// Create / edit a scheduled match.
export default function FixtureForm({ title, initial, onSubmit, onClose }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError("Give the match a title, e.g. Match 8.");
    if (!form.date) return setError("Pick a date.");
    if (form.home === form.away) return setError("Pick two different teams.");
    const overs = Math.round(Number(form.overs));
    if (!(overs >= 1 && overs <= 50)) return setError("Overs per side must be between 1 and 50.");
    onSubmit({ ...form, title: form.title.trim(), venue: form.venue.trim(), overs });
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
            Match title
            <input autoFocus value={form.title} onChange={set("title")} placeholder="e.g. Match 8 / Final" />
          </label>
          <label className="field">
            Home team
            <select value={form.home} onChange={set("home")}>
              {TEAMS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Away team
            <select value={form.away} onChange={set("away")}>
              {TEAMS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Date
            <input type="date" value={form.date} onChange={set("date")} />
          </label>
          <label className="field">
            Start time
            <input type="time" value={form.time} onChange={set("time")} />
          </label>
          <label className="field span-2">
            Venue
            <input value={form.venue} onChange={set("venue")} placeholder="Ground name" />
          </label>
          <label className="field span-2">
            Overs per side
            <span className="segmented overs-pick">
              {OVER_PRESETS.map((o) => (
                <button
                  type="button"
                  key={o}
                  className={Number(form.overs) === o ? "active" : ""}
                  onClick={() => setForm((f) => ({ ...f, overs: o }))}
                >
                  {o}
                </button>
              ))}
              <input
                type="number"
                min="1"
                max="50"
                aria-label="Custom overs"
                value={form.overs}
                onChange={set("overs")}
              />
            </span>
          </label>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary">Save match</button>
        </div>
      </form>
    </div>
  );
}
