import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Dices, Footprints, RotateCcw, ScanFace, User, X } from "lucide-react";
import LookPreview from "./LookPreview.jsx";
import ModelPicker from "./ModelPicker.jsx";
import {
  BEARDS, BROWS, BUILDS, EYE_COLORS, FACE_SHAPES, GEAR_COLORS, GLASSES, HAIR_COLORS, HAIR_STYLES, HEADWEAR, LENSES,
  NOSES, SHOE_COLORS, SKIN_TONES, UMPIRE_HATS, UMPIRE_SHIRTS, UMPIRE_TROUSERS, WRISTBANDS, defaultLook, lookFor, randomLook,
} from "../replay/look.js";

// Full-screen character creator for one player (or the umpire): a big 3D preview you can turn and
// zoom, and tabs for the face, hair, gear and kit. Saves the look (and jersey number).
export default function CharacterCreator({ mode = "player", name = "", jersey = "", look: initial, kit, onSave, onClose, initialView = "full", initialRole }) {
  const umpire = mode === "umpire";
  const [look, setLook] = useState(() => lookFor({ name, look: initial || {} }));
  const [number, setNumber] = useState(jersey ?? "");
  const [tab, setTab] = useState("face");
  const [view, setView] = useState(initialView);
  const [role, setRole] = useState(umpire ? "umpire" : initialRole || "fielder");
  const set = (k, v) => setLook((l) => ({ ...l, [k]: v }));
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  // jump the camera to what's being edited
  const goTab = (t) => {
    setTab(t);
    setView(t === "face" || t === "hair" ? "face" : t === "gear" ? "full" : "full");
  };

  const Swatches = ({ k, list, label, team }) => (
    <div className="cc-row">
      <span className="cc-label">{label}</span>
      <div className="cc-swatches" role="radiogroup" aria-label={label}>
        {list.map((c) => (
          <button
            type="button"
            key={c}
            role="radio"
            aria-checked={look[k] === c}
            aria-label={c === "team" ? "Team colour" : c}
            title={c === "team" ? "Team colour" : c}
            className={`cc-swatch ${c === "team" ? "team" : ""} ${look[k] === c ? "on" : ""}`}
            style={c === "team" ? { background: `conic-gradient(${team?.shirt || "#ff7a2e"} 0 50%, ${team?.trim || "#ffc81a"} 0)` } : { background: c }}
            onClick={() => set(k, c)}
          />
        ))}
      </div>
    </div>
  );
  const Chips = ({ k, list, label, onPick }) => (
    <div className="cc-row">
      <span className="cc-label">{label}</span>
      <div className="cc-chips" role="radiogroup" aria-label={label}>
        {list.map(([v, l]) => (
          <button type="button" key={v} role="radio" aria-checked={look[k] === v} className={look[k] === v ? "on" : ""} onClick={() => (onPick ? onPick(v) : set(k, v))}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );

  const tabs = umpire
    ? [["face", "Face"], ["hair", "Hair & beard"], ["gear", "Umpire kit"], ["body", "Body"]]
    : [["face", "Face"], ["hair", "Hair & beard"], ["gear", "Cap, glasses & shoes"], ["body", "Body & shirt"]];

  return createPortal(
    <div className="cc-backdrop" onMouseDown={onClose}>
      <div className="cc" role="dialog" aria-modal="true" aria-label={`Customize ${name || "character"}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="cc-stage">
          <LookPreview look={look} kit={kit} name={name} number={number} role={role} view={view} />
          <div className="cc-stage-top">
            <span className="cc-name">
              {!umpire && number !== "" && <b>{number}</b>}
              {look.shirtName || name || (umpire ? "Umpire" : "Player")}
            </span>
            <button type="button" className="hp-btn" onClick={onClose} aria-label="Close without saving">
              <X size={18} />
            </button>
          </div>
          <div className="cc-stage-bar">
            <div className="cc-seg" role="radiogroup" aria-label="Camera">
              {[["full", "Body", User], ["face", "Face", ScanFace], ["feet", "Shoes", Footprints]].map(([v, l, Icon]) => (
                <button type="button" key={v} role="radio" aria-checked={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
                  <Icon size={14} /> {l}
                </button>
              ))}
            </div>
            {!umpire && (
              <div className="cc-seg" role="radiogroup" aria-label="Preview as">
                {[["fielder", "Fielding"], ["batter", "Batting"]].map(([v, l]) => (
                  <button type="button" key={v} role="radio" aria-checked={role === v} className={role === v ? "on" : ""} onClick={() => setRole(v)}>
                    {l}
                  </button>
                ))}
              </div>
            )}
            <span className="cc-hint">Drag to turn</span>
          </div>
        </div>

        <div className="cc-panel">
          <div className="cc-head">
            <h2>{umpire ? "Customize the umpire" : `Customize ${name || "player"}`}</h2>
            <div className="cc-head-actions">
              <button type="button" className="btn ghost sm" onClick={() => setLook((l) => ({ ...l, ...randomLook() }))} title="Random look">
                <Dices size={15} /> Randomize
              </button>
              <button type="button" className="btn ghost sm" onClick={() => setLook({ ...defaultLook(name), model: look.model })} title="Back to this player's default look">
                <RotateCcw size={15} /> Reset
              </button>
            </div>
          </div>
          <div className="cc-tabs" role="tablist">
            {tabs.map(([v, l]) => (
              <button type="button" key={v} role="tab" aria-selected={tab === v} className={tab === v ? "on" : ""} onClick={() => goTab(v)}>
                {l}
              </button>
            ))}
          </div>

          <div className="cc-body">
            {tab === "face" && (
              <>
                <Swatches k="skin" list={SKIN_TONES} label="Skin tone" />
                <Chips k="faceShape" list={FACE_SHAPES} label="Face shape" />
                <Swatches k="eyeColor" list={EYE_COLORS} label="Eye colour" />
                <Chips k="brows" list={BROWS} label="Eyebrows" />
                <Chips k="nose" list={NOSES} label="Nose" />
              </>
            )}
            {tab === "hair" && (
              <>
                <Chips k="hair" list={HAIR_STYLES} label="Hairstyle" />
                <Swatches k="hairColor" list={HAIR_COLORS} label="Hair & beard colour" />
                <Chips k="beard" list={BEARDS} label="Beard" />
                {!umpire && <p className="cc-note">Fielders' hair shows under the cap; pick “Nothing” in Cap to see it all.</p>}
              </>
            )}
            {tab === "gear" && !umpire && (
              <>
                <Chips k="headwear" list={HEADWEAR} label="Fielding headwear" onPick={(v) => (set("headwear", v), setRole("fielder"), setView("full"))} />
                <Swatches k="capColor" list={GEAR_COLORS} label="Cap / hat colour" team={kit} />
                <Swatches k="helmetColor" list={GEAR_COLORS} label="Helmet colour (batting)" team={kit} />
                <Chips k="glasses" list={GLASSES} label="Sunglasses" onPick={(v) => (set("glasses", v), setView("face"))} />
                {look.glasses !== "none" && <Chips k="lens" list={LENSES} label="Lenses" />}
                <Swatches k="shoes" list={SHOE_COLORS} label="Shoes" />
                <Swatches k="shoeAccent" list={GEAR_COLORS} label="Shoe stripe" team={kit} />
                <Chips k="wristbands" list={WRISTBANDS} label="Wristbands" />
              </>
            )}
            {tab === "gear" && umpire && (
              <>
                <Chips k="umpireHat" list={UMPIRE_HATS} label="Hat" />
                <Swatches k="umpireShirt" list={UMPIRE_SHIRTS} label="Shirt" />
                <Swatches k="umpireTrousers" list={UMPIRE_TROUSERS} label="Trousers" />
                <Chips k="glasses" list={GLASSES} label="Glasses" onPick={(v) => (set("glasses", v), setView("face"))} />
                {look.glasses !== "none" && <Chips k="lens" list={LENSES} label="Lenses" />}
                <Swatches k="shoes" list={SHOE_COLORS} label="Shoes" />
              </>
            )}
            {tab === "body" && (
              <>
                <Chips k="build" list={BUILDS} label="Build" />
                <div className="cc-row">
                  <span className="cc-label">
                    Height <b>{look.height} cm</b>
                  </span>
                  <input type="range" min="150" max="205" value={look.height} onChange={(e) => set("height", Number(e.target.value))} aria-label="Height in cm" />
                </div>
                {!umpire && (
                  <div className="cc-grid">
                    <label className="field">
                      Jersey number
                      <input value={number} onChange={(e) => setNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} inputMode="numeric" placeholder="e.g. 18" />
                    </label>
                    <label className="field">
                      Name on the shirt
                      <input value={look.shirtName} onChange={(e) => set("shirtName", e.target.value.slice(0, 14))} placeholder={name || "Name"} />
                    </label>
                  </div>
                )}
                {!umpire && (
                  <div className="cc-row">
                    <span className="cc-label">3D model</span>
                    <ModelPicker mode="player" value={look.model || ""} onChange={(id) => set("model", id || undefined)} />
                    <p className="cc-note">A loaded model replaces the built-in body; face and hair options apply to the built-in one.</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="cc-foot">
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn primary" onClick={() => onSave({ look, jersey: number })}>
              Save character
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
