import { useEffect, useRef, useState } from "react";
import { getClip } from "../lib/videoClips.js";
import { commentaryLine } from "../replay/audio.js";

// The TV graphic for a moment's big moment.
export function bigText(m) {
  const t = String(m?.title || "").toUpperCase();
  switch (m?.kind) {
    case "six":
      return ["SIX!", "six"];
    case "four":
      return ["FOUR!", "four"];
    case "wicket":
      return [{ b: "BOWLED!", c: "CAUGHT!", cb: "CAUGHT & BOWLED!", lbw: "OUT! LBW", st: "STUMPED!", ro: "RUN OUT!", hw: "HIT WICKET!" }[m.play?.how] || "OUT!", "w"];
    case "catch":
      return ["WHAT A CATCH!", "w"];
    case "drop":
      return ["DROPPED!", "funny"];
    case "wide":
      return ["WIDE!", "x"];
    case "noball":
      return ["NO BALL!", "x"];
    case "freehit":
      return ["FREE HIT!", "six"];
    case "milestone":
      return [t.includes("HUNDRED") ? "HUNDRED!" : "FIFTY!", "star"];
    case "result":
      return ["WINNERS!", "star"];
    case "star":
      return [t.split("·")[0].trim().slice(0, 18) || "STAR!", "star"];
    default:
      return [String(m?.title || "").slice(0, 22), "funny"];
  }
}

const REPLAY_RATE = 0.35;

// Plays a highlight's real footage: the trimmed clip, then a slow-motion replay around the big
// moment, with the TV graphic, a lower-third player card, the crowd roar and commentary.
export default function VideoMoment({ moment, playing, rate, sound, audio, people, onEnd, onBurst, onSlow, onWalkoff, barRef }) {
  const ref = useRef(null);
  const [clip, setClip] = useState(null);
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const [card, setCard] = useState(true);
  const phase = useRef("live");
  const fired = useRef(false);
  const ended = useRef(false);
  const cb = useRef({});
  cb.current = { onEnd, onBurst, onSlow, onWalkoff, audio, playing, rate };

  useEffect(() => {
    let alive = true;
    let u = "";
    getClip(moment.videoKey)
      .then((c) => {
        if (!alive) return;
        if (!c?.blob) return setFailed(true);
        u = URL.createObjectURL(c.blob);
        setClip(c);
        setUrl(u);
      })
      .catch(() => alive && setFailed(true));
    const hide = setTimeout(() => setCard(false), 4200);
    return () => {
      alive = false;
      clearTimeout(hide);
      if (u) URL.revokeObjectURL(u);
    };
  }, [moment.videoKey]);

  // drive the clip: live part, then the replay
  useEffect(() => {
    const v = ref.current;
    if (!v || !clip) return undefined;
    const start = clip.start || 0;
    const end = clip.end > start ? clip.end : v.duration || start + 5;
    const peak = Math.min(Math.max(clip.peak ?? (start + end) / 2, start), end);
    const rStart = Math.max(start, peak - 2.2);
    const rEnd = Math.min(end, peak + 1.3);
    const hasReplay = rEnd - rStart > 0.8;
    const total = end - start + (hasReplay ? (rEnd - rStart) / REPLAY_RATE : 0);
    const finish = () => {
      if (ended.current) return;
      ended.current = true;
      v.pause();
      cb.current.onSlow("");
      // a wicket: hold the last frame with the scorecard graphic for 3 s, then move on
      if (moment.card && cb.current.onWalkoff) {
        cb.current.onWalkoff(true);
        setTimeout(() => {
          cb.current.onWalkoff(false);
          cb.current.onEnd();
        }, 3000);
      } else cb.current.onEnd();
    };
    v.currentTime = start;
    let raf;
    // watchdog: if the video stops moving while it should be playing (a format this browser
    // can't decode, a broken file), carry on with the next highlight
    let lastCt = -1;
    let stuckSince = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const ct = v.currentTime;
      const now = performance.now();
      if (ct !== lastCt || !cb.current.playing) {
        lastCt = ct;
        stuckSince = now;
      } else if (now - stuckSince > 8000) {
        setFailed(true);
        return finish();
      }
      const { onBurst, onSlow, audio: au } = cb.current;
      if (phase.current === "live") {
        if (!fired.current && ct >= peak - 0.05) {
          fired.current = true;
          const [text, tone] = bigText(moment);
          onBurst({ text, tone, key: `${moment.videoKey}-peak` });
          if (au) {
            if (["six", "w", "star"].includes(tone)) au.roar(tone === "six" ? 1.3 : 1.1);
            else if (tone === "four") au.roar(0.9);
            au.say(commentaryLine(moment), { now: true });
          }
          setTimeout(() => cb.current.onBurst(null), 1800);
        }
        if (ct >= end - 0.03) {
          if (!hasReplay) return finish();
          phase.current = "replay";
          v.currentTime = rStart;
          v.playbackRate = REPLAY_RATE * cb.current.rate;
          onSlow("▶ REPLAY · SLOW-MO");
        }
      } else if (ct >= rEnd - 0.03) return finish();
      if (barRef.current) {
        const done = phase.current === "live" ? ct - start : end - start + (ct - rStart) / REPLAY_RATE;
        barRef.current.style.width = `${Math.min(100, (done / total) * 100)}%`;
      }
    };
    raf = requestAnimationFrame(tick);
    const onEndedEvt = () => (phase.current === "replay" || !hasReplay ? finish() : null);
    v.addEventListener("ended", onEndedEvt);
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("ended", onEndedEvt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip]);

  // play / pause / speed / sound from the player's controls
  useEffect(() => {
    const v = ref.current;
    if (!v || !clip) return;
    v.playbackRate = (phase.current === "replay" ? REPLAY_RATE : 1) * rate;
    v.muted = !sound;
    if (playing && !ended.current) {
      v.play().catch(() => {
        // the browser blocked sound without a click: play muted instead
        v.muted = true;
        v.play().catch(() => {});
      });
    } else v.pause();
  }, [playing, rate, sound, clip]);

  useEffect(() => {
    if (failed) {
      const id = setTimeout(() => {
        if (ended.current) return;
        ended.current = true;
        cb.current.onSlow("");
        cb.current.onEnd();
      }, 1200);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [failed]);

  const who = people?.main;
  return (
    <div className="vm">
      {url && <video ref={ref} className="vm-video" src={url} playsInline preload="auto" onError={() => setFailed(true)} />}
      {failed && <p className="vm-missing">{url ? "This browser can't play that video format (try an .mp4 / H.264 clip)." : "This highlight's video is no longer on this device."}</p>}
      <span className="vm-tag">● MATCH VIDEO</span>
      {card && who?.name && (
        <div className="vm-card">
          {who.jersey !== undefined && who.jersey !== "" && <b className="vm-no">{who.jersey}</b>}
          <span>
            <strong>{who.name}</strong>
            <small>{people.line}</small>
          </span>
        </div>
      )}
    </div>
  );
}
