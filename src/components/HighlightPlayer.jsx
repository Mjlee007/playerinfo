import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Settings2 } from "lucide-react";
import { QUALITY_LEVELS, qualityPref, setQualityPref } from "../replay/pipeline.js";
import { CalendarClock, MapPin, Maximize, Minimize, Pause, Play, RotateCcw, Search, SkipBack, SkipForward, User, Users, Volume2, VolumeX, X } from "lucide-react";
import { createWorld } from "../replay/world.js";
import { getDefaultModel, loadModelById, loadModels, setDefaultModel } from "../replay/models.js";
import ModelPicker from "./ModelPicker.jsx";
import VideoMoment from "./VideoMoment.jsx";
import CharacterCreator from "./CharacterCreator.jsx";
import { readUmpire, saveUmpire } from "../lib/umpire.js";
import { COUNTRY_LIST, DEFAULT_GROUND, GROUNDS, LIGHTS, findGround, groundForVenue } from "../replay/grounds.js";
import { CONTACT, applyFrame, clipFor } from "../replay/clips.js";
import { commentaryLine, createAudio, runUpLine, setSoundPref, soundPref, welcomeLine } from "../replay/audio.js";

// moments where the bat meets the ball at CONTACT (for the crack of the bat)
const hitsBall = (mo) => ["six", "four", "catch", "drop", "milestone"].includes(mo?.kind) || (mo?.kind === "wicket" && ["c", "cb", "ro"].includes(mo?.play?.how)) || (mo?.kind === "noball" && (mo?.play?.runs || 0) > 0);
const ROAR = { six: 1.3, four: 0.9, w: 1.1, star: 1.2 };
import { TEAMS, findTeam } from "../model/teams.js";
import { teamCode } from "../lib/series.js";
import { useSquads } from "../context/FixturesContext.jsx";
import { Color } from "three";

const kit = (id) => {
  const t = findTeam(id) || TEAMS[0];
  // coloured clothing: team shirt, dark team-tinted trousers, trim in the second colour
  return { shirt: t.accent, trousers: new Color(t.accent2).lerp(new Color("#0b1220"), 0.6).getStyle(), trim: t.accent2, code: t.code, team: t.name };
};
// who gets named on the wicket card, by how the batter was out
const WK_ROLES = { c: { fielder: "Caught by" }, st: { fielder: "Stumped by" }, ro: { fielder: "Run out by" } };
const otherOf = (teams, id) => teams.find((t) => t !== id) || TEAMS.find((t) => t.id !== id)?.id;

// Last ground / light picked, remembered on this device.
const PREFS_KEY = "playerinfo.highlights.ground.v1";
function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
  } catch {
    return {};
  }
}
function writePrefs(p) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* private mode: fine */
  }
}
// <input type="datetime-local"> value: the match's own date + time, or now
const pad = (n) => String(n).padStart(2, "0");
function defaultWhen(date, time) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return `${date}T${/^\d{1,2}:\d{2}/.test(time || "") ? time.slice(0, 5).padStart(5, "0") : "19:30"}`;
  const d = date ? new Date(date) : new Date();
  const v = Number.isNaN(d.getTime()) ? new Date() : d;
  return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}T${pad(v.getHours())}:${pad(v.getMinutes())}`;
}
function parseWhen(s) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
const fmtDate = (d) => d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtShortDate = (d) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const fmtTime = (d) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

// A country's flag as coloured stripes (emoji flags don't show on Windows).
function Flag({ flag, size = 18 }) {
  const [dir, ...cols] = flag;
  return (
    <span className={`gflag ${dir}`} style={{ width: size * 1.5, height: size }} aria-hidden="true">
      {cols.map((c, i) => (
        <i key={i} style={{ background: c }} />
      ))}
    </span>
  );
}

// Small drawing of the ground for its card: sky for the light, stands, grass.
function GroundThumb({ g, light }) {
  const L = LIGHTS[light] || LIGHTS[g.light];
  const [a, b] = g.grass;
  return (
    <span className="gthumb" aria-hidden="true" style={{ background: `linear-gradient(${L.top}, ${L.horizon})` }}>
      {g.mountains && <i className={`gt-mtn ${g.mountains}`} />}
      {g.skyline && <i className="gt-city" />}
      {g.stands !== "open" && <i className="gt-roof" style={{ background: g.roof }} />}
      <i className={`gt-stand ${g.stands}`} style={{ background: g.seats }} />
      {g.trees && <i className="gt-trees" />}
      <i className="gt-grass" style={{ background: g.mowing === "checks" ? `repeating-conic-gradient(${a} 0 25%, ${b} 0 50%) 0 0 / 18px 18px` : `repeating-linear-gradient(90deg, ${a} 0 14px, ${b} 14px 28px)` }} />
      <i className="gt-pitch" style={{ background: g.pitch[1] }} />
      {L.lamps && <i className="gt-lamps" />}
    </span>
  );
}

// 3D "video" of a match's highlights: each moment is acted out by animated players, one after
// another, like a TV highlights package. Rendered live with WebGL, so it also works offline.
export default function HighlightPlayer({ moments: input, start = 0, teams = [], title = "Highlights", date, time, venue, onClose }) {
  // Playing the whole reel from the top first shows the match setup (ground, day, characters),
  // then opens with a stadium fly-in and "Welcome to …".
  const fromTop = start === 0;
  const prefs = useRef(readPrefs()).current;
  const [groundId, setGroundId] = useState(() => groundForVenue(venue)?.id || prefs.ground || DEFAULT_GROUND);
  const [lightPick, setLightPick] = useState(prefs.light || "auto");
  const [when, setWhen] = useState(() => defaultWhen(date, time));
  const [started, setStarted] = useState(!fromTop);
  const ground = findGround(groundId) || findGround(DEFAULT_GROUND);
  const lightKey = lightPick === "auto" ? ground.light : lightPick;
  const whenDate = parseWhen(when);
  const [moments, setMoments] = useState(input);
  // real match footage: moments with a videoKey play the clip instead of the 3D animation
  const videoCount = input.filter((x) => x.videoKey).length;
  const [videosOn, setVideosOn] = useState(true);
  const videosOnRef = useRef(true);
  videosOnRef.current = videosOn;
  const [videoRun, setVideoRun] = useState(0);
  // picture quality (auto keeps it smooth), an optional FPS meter, TV wipes between shots
  const [quality, setQuality] = useState(qualityPref);
  const [showFps, setShowFps] = useState(false);
  const [gfxPanel, setGfxPanel] = useState(false);
  const fpsRef = useRef(null);
  const [wipe, setWipe] = useState(null); // { key, text }
  const [wicketCard, setWicketCard] = useState(null); // the dismissal graphic, shown once the batter is out
  const wipeN = useRef(0);
  const showWipe = (text) => setWipe({ key: ++wipeN.current, text });
  const chooseQuality = (q) => {
    setQuality(q);
    setQualityPref(q);
    worldRef.current?.setQuality(q);
  };
  const audioRef = useRef(null);
  if (!audioRef.current) audioRef.current = createAudio({ enabled: soundPref() });
  const [sound, setSound] = useState(() => audioRef.current.on);
  const toggleSound = () => {
    const v = !audioRef.current.on;
    audioRef.current.unlock();
    audioRef.current.setOn(v);
    setSoundPref(v);
    setSound(v);
  };
  useEffect(() => () => audioRef.current?.dispose(), []);
  const startedRef = useRef(started);
  startedRef.current = started;
  const begin = () => {
    audioRef.current.unlock();
    writePrefs({ ground: groundId, light: lightPick });
    setMoments(fromTop ? [{ id: "intro", kind: "intro", title: "WELCOME", text: ground.name.toUpperCase(), welcome: true }, ...input] : input);
    idxRef.current = 0;
    setIndex(0);
    playingRef.current = true;
    setPlaying(true);
    setStarted(true);
  };
  const shellRef = useRef(null);
  const canvasRef = useRef(null);
  const barRef = useRef(null);
  const worldRef = useRef(null);
  const clipRef = useRef(null);
  const tRef = useRef(0);
  const idxRef = useRef(start);
  const playingRef = useRef(true);
  const rateRef = useRef(1);
  const [index, setIndex] = useState(start);
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState(1);
  const [burst, setBurst] = useState(null);
  const [slowMo, setSlowMo] = useState(false); // "slow" window or a replay is playing
  const [full, setFull] = useState(false);
  const [error, setError] = useState("");
  // character models: worldKey rebuilds the 3D world after the model changes
  const [worldKey, setWorldKey] = useState(0);
  const [charPanel, setCharPanel] = useState(false);
  // the model everyone uses ("" = built-in cricketers); players can pick their own in the player editor
  const [defaultModel, setDefaultModelState] = useState(getDefaultModel);
  const chooseDefault = (id) => {
    setDefaultModel(id);
    setDefaultModelState(id);
    if (startedRef.current) setWorldKey((k) => k + 1);
  };

  const m = moments[index];
  // the scorecard graphic shows while the out batter walks off (the last 3 s of a wicket)
  useEffect(() => setWicketCard(null), [index]);
  const videoNow = videosOn && !!m?.videoKey && started;

  // The player on a match video's lower-third card.
  const peopleFor = (mo) => {
    const p = mo?.play || {};
    const bat = mo?.bat || mo?.team || teams[0];
    const field = otherOf(teams, bat);
    const find = (team, name) => (name && (squads?.[team] || []).find((x) => x.name?.trim().toLowerCase() === String(name).trim().toLowerCase())) || (name ? { name } : null);
    const code = (t) => (t ? teamCode(t) : "");
    if (mo?.kind === "catch" || mo?.kind === "drop") return { main: find(field, p.fielder) || find(bat, p.striker), line: `${code(field)} · ${mo.kind === "catch" ? "great catch" : "dropped catch"}` };
    if (mo?.kind === "wicket") return { main: find(bat, p.out || p.striker), line: `${code(bat)} · out${p.bowler ? ` · b ${p.bowler}` : ""}` };
    if (mo?.kind === "wide" || mo?.kind === "noball") return { main: find(field, p.bowler), line: `${code(field)} · bowler` };
    return { main: find(bat, p.striker || p.out), line: `${code(bat)}${mo?.score ? ` · ${mo.score}` : ""}` };
  };

  // Squad players → who appears in the video (names, shirt numbers, looks).
  const squads = useSquads();
  const rosterFor = (bat, field, names) => {
    const find = (team, name) => {
      if (!name) return null;
      const n = String(name).trim().toLowerCase();
      return (squads?.[team] || []).find((p) => p.name?.trim().toLowerCase() === n) || { name };
    };
    const fsq = squads?.[field] || [];
    const bowler = find(field, names.bowler);
    const keeper = fsq.find((p) => /keep/i.test(p.role || ""));
    const rest = fsq.filter((p) => p !== keeper && p.name !== bowler?.name);
    const fielders = [keeper || rest.shift(), ...rest].filter(Boolean).slice(0, 10);
    const bsq = (squads?.[bat] || []).filter((p) => p.name !== names.striker);
    return {
      striker: find(bat, names.striker) || bsq[0] || null,
      nonStriker: find(bat, names.nonStriker) || bsq.find((p) => p.name !== names.striker) || null,
      bowler: bowler || rest.find((p) => /bowl|all/i.test(p.role || "")) || null,
      fielders,
      umpireLook: readUmpire().look,
    };
  };

  // Load a clip: colours for the batting / fielding side, then restart time.
  const load = (i) => {
    const w = worldRef.current;
    const mo = moments[i];
    if (!w || !mo) return;
    const clip = clipFor(mo);
    const bat = mo.bat || mo.team || teams[0];
    const p = mo.play || {};
    const names = { striker: p.striker || p.out, nonStriker: p.nonStriker, bowler: p.bowler };
    if (p.how === "ro" && p.out) {
      // the 3D run out happens at the non-striker's end
      names.nonStriker = p.out;
      names.striker = p.out === p.striker ? p.nonStriker || "" : p.striker;
    }
    if (clip.winners) {
      const winner = mo.team || teams[0];
      const loser = otherOf(teams, winner);
      w.setTeams(kit(loser), kit(winner), {}, rosterFor(loser, winner, {}));
    } else w.setTeams(kit(bat), kit(otherOf(teams, bat)), names, rosterFor(bat, otherOf(teams, bat), names));
    w.clearTrail();
    const asVideo = videosOnRef.current && !!mo.videoKey;
    clipRef.current = asVideo ? null : clip; // a video moment pauses the 3D world
    spokenRef.current = false;
    const au = audioRef.current;
    if (mo.welcome) {
      au.sting();
      au.say(welcomeLine(ground, whenDate, title), { now: true });
    } else if (!asVideo && clip.duration > 7) au.say(runUpLine(mo), { now: true });
    setVideoRun((n) => n + 1);
    setSlowMo("");
    if (i !== idxRef.current || tRef.current > 0) showWipe(mo.welcome ? "" : (mo.title || "").toUpperCase());
    tRef.current = 0;
    idxRef.current = i;
    setIndex(i);
    setBurst(null);
  };
  const go = (i) => {
    if (i < 0 || i >= moments.length) return;
    load(i);
    playingRef.current = true;
    setPlaying(true);
  };
  const spokenRef = useRef(false);
  const toggle = () => {
    audioRef.current.unlock();
    const clip = clipRef.current;
    if (!playingRef.current && clip && tRef.current >= clip.duration - 0.01) tRef.current = 0; // replay at the end
    playingRef.current = !playingRef.current;
    setPlaying(playingRef.current);
  };
  const restart = () => {
    setVideoRun((n) => n + 1);
    tRef.current = 0;
    worldRef.current?.clearTrail();
    playingRef.current = true;
    setPlaying(true);
  };
  const toggleRate = () => {
    rateRef.current = rateRef.current === 1 ? 0.5 : 1;
    setRate(rateRef.current);
  };
  const toggleFull = () => {
    const el = shellRef.current;
    if (!document.fullscreenElement) el?.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  };

  // World + render loop.
  useEffect(() => {
    if (!started) return undefined;
    let w;
    try {
      w = createWorld(canvasRef.current, { sides: teams.length === 2 ? teams : ["nrv", "vpn"], ground, light: lightKey, quality });
    } catch {
      setError("3D replays need WebGL, which this browser or device doesn't support.");
      return;
    }
    worldRef.current = w;
    load(idxRef.current);
    // real character models, if any are installed in public/models (falls back to the built-in ones)
    let alive = true;
    loadModels(import.meta.env.BASE_URL)
      .then((set) => alive && w.useModels(set))
      .catch(() => {});
    // players' own models (look.model in the squads)
    const ids = [...new Set(Object.values(squads || {}).flat().map((p) => p?.look?.model).filter((id) => id && id !== "builtin"))];
    if (ids.length) {
      Promise.all(ids.map((id) => loadModelById(id).then((t) => [id, t])))
        .then((pairs) => alive && w.useModelLibrary(Object.fromEntries(pairs.filter(([, t]) => t))))
        .catch(() => {});
    }
    const fit = () => {
      const r = canvasRef.current.parentElement.getBoundingClientRect();
      w.resize(r.width, r.height);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvasRef.current.parentElement);

    let raf;
    let last = performance.now();
    let lastBurst = "";
    let lastSlow = false;
    let lastReplay = false;
    let frameT = 0;
    let lastWalk = false;
    let lastStumps = -1;
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const clip = clipRef.current;
      if (!clip) return;
      let t = tRef.current;
      const slow = (clip.slow || []).find(([a, b]) => t >= a && t < b);
      if (playingRef.current) {
        t += dt * rateRef.current * (slow ? slow[2] : 1);
        if (t >= clip.duration) {
          if (idxRef.current < moments.length - 1) {
            load(idxRef.current + 1);
            return;
          }
          t = clip.duration;
          playingRef.current = false;
          setPlaying(false);
        }
        tRef.current = t;
      }
      const prevT = frameT;
      frameT = t;
      const f = clip.update(t);
      applyFrame(w, f, t);
      const au = audioRef.current;
      const moNow = moments[idxRef.current];
      if (!!f.walkoff !== lastWalk) {
        lastWalk = !!f.walkoff;
        setWicketCard(lastWalk && moNow?.card ? { ...moNow.card, team: moNow.team || moNow.bat, key: `${idxRef.current}-walk` } : null);
      }
      au.excite(f.replay ? 0.15 : f.excite ?? 0.1);
      if (!f.replay && prevT < CONTACT && t >= CONTACT && hitsBall(moNow)) au.bat();
      const sb = Math.max(f.st.stumpsBat ?? -1, f.st.stumpsBowl ?? -1);
      if (sb >= 0 && lastStumps < 0) au.stumps();
      lastStumps = sb;
      if ((f.replay || false) !== lastReplay) {
        lastReplay = f.replay || false;
        w.clearTrail();
      }
      const mo = moments[idxRef.current];
      const top = mo?.welcome ? ground.name.toUpperCase() : title.toUpperCase();
      // the big screen names the batter with their score when he's out
      if (mo?.card && f.screen?.color === "#ff5d6c") f.screen = { ...f.screen, small: `${mo.card.batter} ${mo.card.runs} (${mo.card.balls})` };
      w.setScreen(f.screen ? { top, ...f.screen } : { top, big: mo?.score || "PLAYER INFO", small: mo?.title || "" });
      w.setCamera(f.cam, dt);
      w.render(now / 1000);
      if (barRef.current) barRef.current.style.width = `${(t / clip.duration) * 100}%`;
      const b = (clip.bursts || []).find((x) => t >= x.t && t < x.t + 1.7);
      const key = b ? `${idxRef.current}-${b.t}` : "";
      if (key !== lastBurst) {
        lastBurst = key;
        setBurst(b ? { ...b, key } : null);
        if (b && !f.replay) {
          if (ROAR[b.tone]) au.roar(ROAR[b.tone]);
          if (b.text === "HOWZAT?!") au.appeal();
          if (!spokenRef.current && b.tone !== "x" && !String(b.text).startsWith("UMPIRE")) {
            spokenRef.current = true;
            au.say(commentaryLine(moNow), { now: true });
          } else if (b.text === "UMPIRE · OUT!") au.say("And the finger goes up!");
          else if (b.text === "WICKETS · HITTING") au.say("Hawk-Eye says... hitting the stumps!", { now: true });
          else if (!spokenRef.current && (moNow?.kind === "wide" || moNow?.kind === "noball")) {
            spokenRef.current = true;
            au.say(commentaryLine(moNow), { now: true });
          }
        }
      }
      if (fpsRef.current && now - (fpsRef.lastShown || 0) > 500) {
        fpsRef.lastShown = now;
        const qi = w.qualityInfo;
        fpsRef.current.textContent = `${Math.round(w.fps)} FPS · ${qi.effects}${qi.scale < 100 ? ` · ${qi.scale}%` : ""}`;
      }
      const isSlow = f.replay === "hawk" ? "HAWK-EYE" : typeof f.replay === "string" ? `▶ REPLAY · ${f.replay}` : (!!slow && playingRef.current) || f.replay ? "▶ REPLAY · SLOW-MO" : "";
      if (isSlow !== lastSlow) {
        if (isSlow && !lastSlow && f.replay) showWipe(f.replay === "hawk" ? "HAWK-EYE" : "REPLAY");
        lastSlow = isSlow;
        setSlowMo(isSlow);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      w.dispose();
      worldRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldKey, started]);

  // Keyboard + fullscreen state.
  useEffect(() => {
    const onKey = (e) => {
      if (!startedRef.current) {
        if (e.key === "Escape") onClose();
        return;
      }
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowRight") go(idxRef.current + 1);
      else if (e.key === "ArrowLeft") go(idxRef.current - 1);
      else if (e.key === "Escape" && !document.fullscreenElement) onClose();
      else if (e.key === "f") toggleFull();
    };
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="hp-backdrop" onMouseDown={onClose}>
      <div className={`hp ${full ? "full" : ""}`} ref={shellRef} role="dialog" aria-modal="true" aria-label={`${title}: highlights video`} onMouseDown={(e) => e.stopPropagation()}>
        {!started && (
          <GroundSetup
            title={title}
            groundId={groundId}
            setGroundId={setGroundId}
            lightPick={lightPick}
            setLightPick={setLightPick}
            when={when}
            setWhen={setWhen}
            whenDate={whenDate}
            defaultModel={defaultModel}
            chooseDefault={chooseDefault}
            videoCount={videoCount}
            videosOn={videosOn}
            setVideosOn={setVideosOn}
            onStart={begin}
            onClose={onClose}
          />
        )}
        {started && (<>
        <div className="hp-stage" onClick={toggle}>
          <canvas ref={canvasRef} className="hp-canvas" aria-hidden="true" />
          {videoNow && (
            <VideoMoment
              key={`${index}-${videoRun}`}
              moment={m}
              playing={playing}
              rate={rate}
              sound={sound}
              audio={audioRef.current}
              people={peopleFor(m)}
              barRef={barRef}
              onBurst={setBurst}
              onSlow={setSlowMo}
              onWalkoff={(on) => setWicketCard(on && m.card ? { ...m.card, team: m.team || m.bat, key: `${index}-walk` } : null)}
              onEnd={() => {
                if (idxRef.current < moments.length - 1) go(idxRef.current + 1);
                else {
                  playingRef.current = false;
                  setPlaying(false);
                }
              }}
            />
          )}
          {error && <p className="hp-error">{error}</p>}

          <div className="hp-top">
            <span className="hp-tag">
              <span className="live-dot" /> HIGHLIGHTS
            </span>
            <span className="hp-match">{title}</span>
            {m?.score && (
              <span className="hp-score" style={{ "--team": kit(m.team || m.bat || teams[0]).shirt }}>
                <b className="hp-score-team">{teamCode(m.team || m.bat || teams[0])}</b>
                {String(m.score).replace(/^[A-Z]{2,4}\s+/, "")}
                {m.over && <small>{m.over} ov</small>}
              </span>
            )}
            <span className="hp-venue" title={`${ground.name}, ${ground.city} · ${fmtDate(whenDate)} ${fmtTime(whenDate)}`}>
              <MapPin size={12} /> {ground.name} · {fmtShortDate(whenDate)} · {fmtTime(whenDate)}
            </span>
            <span className="hp-count">
              {index + 1} / {moments.length}
            </span>
          </div>
          {wipe && (
            <div className="hp-wipe" key={wipe.key} style={{ "--a": kit(teams[0]).shirt, "--b": kit(teams[1] || teams[0]).shirt }} onAnimationEnd={(e) => e.target === e.currentTarget && setWipe(null)} aria-hidden="true">
              <i />
              <i />
              {wipe.text && <span>{wipe.text}</span>}
            </div>
          )}
          {showFps && <span className="hp-fps" ref={fpsRef} />}
          {wicketCard && (
            <div className="hp-wk" key={wicketCard.key} style={{ "--team": kit(wicketCard.team || teams[0]).shirt }} role="status">
              <div className="hp-wk-main">
                <b className="hp-wk-tag">OUT</b>
                <span className="hp-wk-name">{wicketCard.batter}</span>
                <span className="hp-wk-score">
                  {wicketCard.runs}
                  <small>({wicketCard.balls})</small>
                </span>
              </div>
              <div className="hp-wk-by">
                <span className="hp-wk-how2">{wicketCard.how}</span>
                {WK_ROLES[wicketCard.dismissal]?.fielder && wicketCard.fielder && wicketCard.fielder !== wicketCard.bowler && (
                  <span>
                    {WK_ROLES[wicketCard.dismissal].fielder} <b>{wicketCard.fielder}</b>
                  </span>
                )}
                {wicketCard.bowler && (
                  <span>
                    {wicketCard.dismissal === "cb" ? "Caught & bowled" : "Bowler"} <b>{wicketCard.bowler}</b>
                  </span>
                )}
              </div>
            </div>
          )}
          {slowMo && <span className={`hp-slow ${slowMo === "HAWK-EYE" ? "hawk" : ""}`}>{slowMo}</span>}
          {burst && (
            <div className={`hp-burst ${burst.tone}`} key={burst.key}>
              {burst.text}
            </div>
          )}
          {m?.welcome && (
            <div className="hp-welcome" key={`welcome-${index}`}>
              <span className="hp-welcome-kicker">Welcome to</span>
              <strong>{ground.name}</strong>
              <span className="hp-welcome-place">
                <Flag flag={ground.flag} size={16} /> {ground.city}, {ground.country}
              </span>
              <span className="hp-welcome-when">
                <CalendarClock size={16} /> {fmtDate(whenDate)} · {fmtTime(whenDate)}
              </span>
              <span className="hp-welcome-match">{title}</span>
            </div>
          )}
          {m && !m.welcome && !wicketCard && (
            <div className={`hp-caption ${m.kind}`} key={`cap-${index}`}>
              <span className="hp-cap-kind">
                {m.team && <b className={`team-tag ${m.team}`}>{teamCode(m.team)}</b>}
                {m.over && <span>Over {m.over}</span>}
                {m.synthetic && <span>· rebuilt from scorecard</span>}
              </span>
              <strong>{m.title}</strong>
              {m.text && <span className="hp-cap-text">{m.text}</span>}
            </div>
          )}
          {!playing && !error && (
            <span className="hp-bigplay" aria-hidden="true">
              <Play size={34} />
            </span>
          )}
        </div>

        {gfxPanel && (
          <div className="hp-chars hp-gfx" role="dialog" aria-label="Picture quality">
            <strong>Picture quality</strong>
            <div className="gs-seg" role="radiogroup" aria-label="Quality">
              {QUALITY_LEVELS.map(([k, label]) => (
                <button key={k} role="radio" aria-checked={quality === k} className={quality === k ? "on" : ""} onClick={() => chooseQuality(k)}>
                  {label}
                </button>
              ))}
            </div>
            <p className="hp-chars-hint">
              Auto lowers the resolution and effects when the device can't keep up, so it stays smooth. Ultra adds
              ambient occlusion and depth of field on close-ups (needs a fast GPU).
            </p>
            <label className="gs-check">
              <input type="checkbox" checked={showFps} onChange={(e) => setShowFps(e.target.checked)} /> Show frame rate
            </label>
          </div>
        )}
        {charPanel && (
          <div className="hp-chars" role="dialog" aria-label="Player characters">
            <strong>Player characters</strong>
            <ModelPicker value={defaultModel} onChange={chooseDefault} dark />
            <p className="hp-chars-hint">
              The model every player uses, unless they have their own (Players → edit → Look in the 3D highlights
              video). Add rigged human models (.glb / .fbx, e.g. from Mixamo); pads, helmets, gloves, bat and shirt
              numbers are added automatically. Saved on this device, works offline.
            </p>
          </div>
        )}

        <div className="hp-bar">
          <div className="hp-segs" role="tablist" aria-label="Highlights">
            {moments.map((mo, i) => (
              <button
                key={mo.id + i}
                role="tab"
                aria-selected={i === index}
                aria-label={`${i + 1}. ${mo.title}`}
                title={mo.title}
                className={`hp-seg ${mo.kind} ${i < index ? "done" : ""}`}
                onClick={() => go(i)}
              >
                {i === index && <span ref={barRef} className="hp-seg-fill" />}
              </button>
            ))}
          </div>
          <div className="hp-controls">
            <button className="hp-btn" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous highlight">
              <SkipBack size={18} />
            </button>
            <button className="hp-btn hp-playbtn" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button className="hp-btn" onClick={() => go(index + 1)} disabled={index >= moments.length - 1} aria-label="Next highlight">
              <SkipForward size={18} />
            </button>
            <button className="hp-btn" onClick={restart} aria-label="Replay this highlight">
              <RotateCcw size={17} />
            </button>
            <button className={`hp-btn rate ${rate !== 1 ? "on" : ""}`} onClick={toggleRate} aria-label="Toggle slow motion">
              {rate === 1 ? "1×" : "½×"}
            </button>
            <span className="hp-now">{m?.title}</span>
            <button className="hp-btn" onClick={toggleSound} aria-label={sound ? "Mute commentary and sound" : "Turn on commentary and sound"} title={sound ? "Sound on" : "Sound off"} aria-pressed={sound}>
              {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
            {fromTop && (
              <button className="hp-btn" onClick={() => setStarted(false)} aria-label="Change ground, date or players" title="Change ground, date or players">
                <MapPin size={17} />
              </button>
            )}
            <button
              className={`hp-btn ${charPanel ? "on" : ""}`}
              onClick={() => {
                setCharPanel((v) => !v);
              }}
              aria-label="Player characters"
              aria-expanded={charPanel}
              title="Player characters"
            >
              <User size={17} />
            </button>
            <button className={`hp-btn ${gfxPanel ? "on" : ""}`} onClick={() => setGfxPanel((v) => !v)} aria-label="Picture quality" aria-expanded={gfxPanel} title="Picture quality">
              <Settings2 size={17} />
            </button>
            <button className="hp-btn" onClick={toggleFull} aria-label={full ? "Exit full screen" : "Full screen"}>
              {full ? <Minimize size={17} /> : <Maximize size={17} />}
            </button>
            <button className="hp-btn" onClick={onClose} aria-label="Close video">
              <X size={18} />
            </button>
          </div>
        </div>
        </>)}
      </div>
    </div>,
    document.body
  );
}

// Match setup before the video: pick the ground (grounds from every cricket country), the day and
// time, the light, and the player characters.
function GroundSetup({ title, groundId, setGroundId, lightPick, setLightPick, when, setWhen, whenDate, defaultModel, chooseDefault, videoCount, videosOn, setVideosOn, onStart, onClose }) {
  const [country, setCountry] = useState(() => findGround(groundId)?.countryCode || "all");
  const [umpire, setUmpire] = useState(readUmpire);
  const [editUmpire, setEditUmpire] = useState(false);
  const [q, setQ] = useState("");
  const ground = findGround(groundId) || findGround(DEFAULT_GROUND);
  const lightKey = lightPick === "auto" ? ground.light : lightPick;
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return GROUNDS.filter((g) => (country === "all" || g.countryCode === country) && (!t || `${g.name} ${g.city} ${g.country}`.toLowerCase().includes(t)));
  }, [country, q]);
  return (
    <div className="gs">
      <div className="gs-head">
        <div>
          <span className="gs-kicker">Match highlights</span>
          <h2>{title}</h2>
        </div>
        <button className="hp-btn" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div className="gs-body">
        <section className="gs-sec">
          <h3>
            <MapPin size={16} /> Choose the ground
          </h3>
          <div className="gs-countries" role="tablist" aria-label="Country">
            <button role="tab" aria-selected={country === "all"} className={`gs-chip ${country === "all" ? "on" : ""}`} onClick={() => setCountry("all")}>
              All
            </button>
            {COUNTRY_LIST.map((c) => (
              <button key={c.code} role="tab" aria-selected={country === c.code} className={`gs-chip ${country === c.code ? "on" : ""}`} onClick={() => setCountry(c.code)}>
                <Flag flag={c.flag} size={11} /> {c.name}
              </button>
            ))}
          </div>
          <label className="gs-search">
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search grounds or cities" aria-label="Search grounds" />
          </label>
          <div className="gs-grid">
            {list.map((g) => (
              <button key={g.id} className={`gs-card ${g.id === groundId ? "on" : ""}`} onClick={() => setGroundId(g.id)} aria-pressed={g.id === groundId}>
                <GroundThumb g={g} light={g.id === groundId ? lightKey : g.light} />
                <span className="gs-card-name">{g.name}</span>
                <span className="gs-card-meta">
                  <Flag flag={g.flag} size={10} /> {g.city} · {g.capacity}
                </span>
              </button>
            ))}
            {!list.length && <p className="gs-empty">No grounds match “{q}”.</p>}
          </div>
        </section>

        <div className="gs-cols">
          <section className="gs-sec">
            <h3>
              <CalendarClock size={16} /> Match day
            </h3>
            <input className="gs-input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Match date and time" />
            <div className="gs-seg" role="radiogroup" aria-label="Light">
              {[["auto", `Usual (${LIGHTS[ground.light].label})`], ["day", "Day"], ["dusk", "Day / night"], ["night", "Night"]].map(([k, label]) => (
                <button key={k} role="radio" aria-checked={lightPick === k} className={lightPick === k ? "on" : ""} onClick={() => setLightPick(k)}>
                  {label}
                </button>
              ))}
            </div>
          </section>
          <section className="gs-sec">
            <h3>
              <Users size={16} /> Players
            </h3>
            <ModelPicker value={defaultModel} onChange={chooseDefault} dark />
            <div className="gs-umpire">
              <span>
                <b>Umpire</b>
              </span>
              <button type="button" className="btn ghost sm" onClick={() => setEditUmpire(true)}>
                Customize umpire
              </button>
            </div>
            {editUmpire && (
              <CharacterCreator
                mode="umpire"
                name="Umpire"
                look={umpire.look}
                onClose={() => setEditUmpire(false)}
                onSave={({ look }) => {
                  const u = { ...umpire, look };
                  saveUmpire(u);
                  setUmpire(u);
                  setEditUmpire(false);
                }}
              />
            )}
            {videoCount > 0 && (
              <label className="gs-check">
                <input type="checkbox" checked={videosOn} onChange={(e) => setVideosOn(e.target.checked)} />
                Play my match videos ({videoCount} highlight{videoCount === 1 ? "" : "s"}); the rest in 3D
              </label>
            )}
            <p className="gs-note">
              The 3D model for everyone. A player can have their own: Players → edit → Look in the 3D highlights video.
              Kits, numbers, pads and helmets are added to any model.
            </p>
          </section>
        </div>
      </div>

      <div className="gs-foot">
        <div className="gs-summary">
          <Flag flag={ground.flag} size={14} />
          <span>
            <b>{ground.name}</b>, {ground.city} · {fmtShortDate(whenDate)} · {fmtTime(whenDate)}
          </span>
        </div>
        <button className="btn primary gs-start" onClick={onStart}>
          <Play size={18} /> Start highlights
        </button>
      </div>
    </div>
  );
}
