import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Crosshair, Film, Trash2, X } from "lucide-react";
import { clipKey, deleteClip, fmtSec, fmtSize, getClip, saveClip, updateClip } from "../lib/videoClips.js";

// Attach real match footage to one highlight: choose or record a video, trim it, and mark the
// big moment (where the SIX! / OUT! graphic shows and the slow-motion replay focuses).
export default function VideoClipDialog({ matchId, moment, onClose }) {
  const key = clipKey(matchId, moment);
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const [saved, setSaved] = useState(null); // clip already stored
  const [file, setFile] = useState(null); // newly chosen file
  const [url, setUrl] = useState("");
  const [dur, setDur] = useState(0);
  const [t, setT] = useState({ start: 0, end: 0, peak: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    getClip(key)
      .then((c) => {
        if (!alive || !c) return;
        setSaved(c);
        setT({ start: c.start || 0, end: c.end || 0, peak: c.peak || 0 });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);
  const blob = file || saved?.blob;
  useEffect(() => {
    if (!blob) return undefined;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  const onMeta = () => {
    const d = videoRef.current?.duration || 0;
    if (!Number.isFinite(d) || d <= 0) return;
    setDur(d);
    setT((v) => {
      if (saved && !file && v.end > 0) return v;
      // a new video: keep the whole thing, big moment two-thirds in
      return { start: 0, end: d, peak: Math.min(d, d * 0.66) };
    });
  };
  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^video\//.test(f.type) && !/\.(mp4|mov|webm|m4v|3gp|mkv)$/i.test(f.name)) return setError("Please choose a video file.");
    setError("");
    setFile(f);
    setDur(0);
  };
  const setAt = (k) => setT((v) => fix({ ...v, [k]: videoRef.current?.currentTime || 0 }, k));
  const fix = (v, changed) => {
    let { start, end, peak } = v;
    if (changed === "start" && start > end - 0.5) end = Math.min(dur, start + 0.5);
    if (changed === "end" && end < start + 0.5) start = Math.max(0, end - 0.5);
    peak = Math.min(Math.max(peak, start), end);
    return { start, end, peak };
  };
  const slider = (k, label, help) => (
    <div className="vc-row">
      <span className="vc-label">
        {label} <b>{fmtSec(t[k])}</b>
        <small>{help}</small>
      </span>
      <input type="range" min="0" max={dur || 1} step="0.1" value={t[k]} onChange={(e) => setT((v) => fix({ ...v, [k]: Number(e.target.value) }, k))} onInput={(e) => videoRef.current && (videoRef.current.currentTime = Number(e.target.value))} aria-label={label} disabled={!dur} />
      <button type="button" className="btn ghost sm" onClick={() => setAt(k)} disabled={!dur} title="Use the video's current position">
        <Crosshair size={14} /> Here
      </button>
    </div>
  );
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      if (file) await saveClip({ key, blob: file, name: file.name, type: file.type, size: file.size, ...t });
      else await updateClip(key, t);
      onClose();
    } catch (e) {
      setError(e?.name === "QuotaExceededError" || /full|quota/i.test(e?.message || "") ? "Not enough storage on this device for that video. Trim it on your phone first or free some space." : e?.message || "Couldn't save the video.");
    }
    setBusy(false);
  };
  const remove = async () => {
    if (!window.confirm("Remove the video from this highlight?")) return;
    await deleteClip(key);
    onClose();
  };

  return createPortal(
    <div className="modal-backdrop stack-top" onMouseDown={onClose}>
      <div className="modal card vc" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Match video">
        <div className="modal-head">
          <h2>
            <Film size={18} /> Match video
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="muted small vc-for">
          For: <b>{moment.title}</b>
          {moment.over ? ` · over ${moment.over}` : ""}
        </p>

        {url ? (
          <video ref={videoRef} className="vc-video" src={url} controls playsInline preload="metadata" onLoadedMetadata={onMeta} />
        ) : (
          <button type="button" className="vc-empty" onClick={() => fileRef.current?.click()}>
            <Film size={28} />
            <b>Choose or record a video</b>
            <span>The clip of this {moment.kind === "six" ? "six" : moment.kind === "four" ? "four" : moment.kind === "wicket" ? "wicket" : "moment"} from your phone. It stays on this device.</span>
          </button>
        )}
        {url && (
          <div className="vc-file">
            <span>
              {(file || saved)?.name || "video"} · {fmtSize((file || saved)?.size || 0)}
              {dur ? ` · ${fmtSec(dur)}` : ""}
            </span>
            <button type="button" className="btn ghost sm" onClick={() => fileRef.current?.click()}>
              Change video
            </button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="video/*" hidden onChange={pick} />

        {url && (
          <div className="vc-trim">
            {slider("start", "Start", "where the clip begins")}
            {slider("peak", "Big moment", "the hit, catch or wicket")}
            {slider("end", "End", "where it stops")}
          </div>
        )}
        {(file?.size || 0) > 400e6 && <p className="error">That's a big file ({fmtSize(file.size)}). Trimming it on your phone first saves space.</p>}
        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          {saved && (
            <button type="button" className="btn danger" style={{ marginRight: "auto" }} onClick={remove}>
              <Trash2 size={15} /> Remove video
            </button>
          )}
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={save} disabled={busy || !url || !dur}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
