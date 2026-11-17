import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addModel, libraryReady, listModels, removeModel } from "../replay/models.js";

// Pick a 3D character model from the device's model library, or add one (.glb / .fbx).
// mode "default": the model everyone uses ("" = built-in cricketers).
// mode "player": this player's model ("" = same as everyone, "builtin" = built-in body).
export default function ModelPicker({ value = "", onChange, mode = "default", dark = false }) {
  const [models, setModels] = useState(listModels);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef(null);
  useEffect(() => {
    const refresh = () => setModels(listModels());
    libraryReady().then(refresh);
    window.addEventListener("playerinfo-models", refresh);
    return () => window.removeEventListener("playerinfo-models", refresh);
  }, []);
  const add = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg("Checking the model…");
    try {
      const m = await addModel(file);
      setMsg(`Added “${m.name}”.`);
      onChange(m.id);
    } catch (err) {
      setMsg(err.message || "Couldn't load that model.");
    }
    setBusy(false);
  };
  const isLibrary = models.some((m) => m.id === value);
  const remove = async () => {
    const m = models.find((x) => x.id === value);
    if (!m || !window.confirm(`Remove the model “${m.name}” from this device? Players using it go back to the default.`)) return;
    await removeModel(value);
    onChange("");
    setMsg("Removed.");
  };
  return (
    <div className={`model-picker ${dark ? "dark" : ""}`}>
      <div className="model-picker-row">
        <select value={isLibrary || value === "builtin" ? value : ""} onChange={(e) => onChange(e.target.value)} disabled={busy} aria-label="3D character model">
          {mode === "player" ? (
            <>
              <option value="">Same as everyone</option>
              <option value="builtin">Built-in cricketer</option>
            </>
          ) : (
            <option value="">Built-in cricketers</option>
          )}
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn ghost sm" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Plus size={14} /> Add model…
        </button>
        {isLibrary && (
          <button type="button" className="icon-btn" onClick={remove} disabled={busy} aria-label="Remove this model from the device" title="Remove this model">
            <Trash2 size={15} />
          </button>
        )}
      </div>
      {msg && (
        <p className="model-picker-msg" role="status">
          {msg}
        </p>
      )}
      <input ref={fileRef} type="file" accept=".glb,.gltf,.fbx" hidden onChange={add} />
    </div>
  );
}
