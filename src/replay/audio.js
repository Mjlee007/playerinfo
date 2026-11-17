// Sound for the 3D highlights: a crowd that murmurs and roars with the action, the crack of bat on
// ball, stumps rattling, a TV-style intro sting, and spoken commentary through the device's own
// text-to-speech voices. Everything is synthesised in the browser, so it also works offline.

const SOUND_KEY = "playerinfo.highlights.sound.v1";
export function soundPref() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}
export function setSoundPref(on) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* private mode */
  }
}

function noiseBuffer(ctx, seconds, brown = false) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
  }
  return buf;
}

export function createAudio({ enabled = true } = {}) {
  let ctx = null;
  let master;
  let crowd;
  let white;
  let on = enabled;
  let crowdLevel = -1;
  const speech = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
  let voice = null;
  const pickVoice = () => {
    const vs = speech?.getVoices?.() || [];
    voice = vs.find((v) => /en-IN/i.test(v.lang)) || vs.find((v) => /en-GB/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
  };
  if (speech) {
    pickVoice();
    speech.addEventListener?.("voiceschanged", pickVoice);
  }

  // Needs a user gesture (the Start / play click) before the browser lets it make sound.
  const ensure = () => {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      return ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = on ? 0.9 : 0;
    master.connect(ctx.destination);
    white = noiseBuffer(ctx, 2);
    // crowd bed: looped brown noise, band-passed to a stadium murmur
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 6, true);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 700;
    bp.Q.value = 0.6;
    crowd = ctx.createGain();
    crowd.gain.value = 0.05;
    src.connect(bp).connect(crowd).connect(master);
    src.start();
    return ctx;
  };

  const burst = ({ freq = 800, q = 0.8, type = "bandpass", attack = 0.01, hold = 0, decay = 0.3, gain = 0.6, when = 0, rate = 1 }) => {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = white;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.setValueAtTime(gain, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + attack + hold + decay + 0.05);
  };
  const tone = ({ freq, type = "sine", attack = 0.005, decay = 0.2, gain = 0.3, when = 0, to }) => {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  };

  const api = {
    unlock: ensure,
    get on() {
      return on;
    },
    setOn(v) {
      on = v;
      if (master) master.gain.setTargetAtTime(v ? 0.9 : 0, ctx.currentTime, 0.05);
      if (!v) speech?.cancel();
    },
    // 0..1: how excited the crowd is right now
    excite(v) {
      if (!ctx || Math.abs(v - crowdLevel) < 0.04) return;
      crowdLevel = v;
      crowd.gain.setTargetAtTime(0.045 + v * 0.3, ctx.currentTime, 0.35);
    },
    bat() {
      burst({ freq: 2400, q: 1.2, type: "highpass", attack: 0.002, decay: 0.05, gain: 0.9 });
      tone({ freq: 1150, type: "triangle", decay: 0.09, gain: 0.45 });
      tone({ freq: 320, type: "sine", decay: 0.12, gain: 0.35 });
    },
    stumps() {
      for (let i = 0; i < 4; i++) {
        burst({ freq: 1800 + i * 300, q: 6, attack: 0.002, decay: 0.05, gain: 0.5, when: i * 0.045 });
        tone({ freq: 620 - i * 60, type: "triangle", decay: 0.07, gain: 0.25, when: i * 0.045 });
      }
    },
    // a roar that swells and fades (six, four, wicket)
    roar(strength = 1) {
      burst({ freq: 650, q: 0.5, attack: 0.25, hold: 0.6 * strength, decay: 2.2, gain: 0.5 * strength });
      burst({ freq: 1500, q: 0.7, attack: 0.3, hold: 0.4 * strength, decay: 1.6, gain: 0.22 * strength });
      for (let i = 0; i < 3 * strength; i++) tone({ freq: 1800 + Math.random() * 900, to: 2600 + Math.random() * 600, type: "sine", attack: 0.05, decay: 0.35, gain: 0.05, when: 0.2 + Math.random() * 1.2 });
    },
    appeal() {
      burst({ freq: 420, q: 1.4, attack: 0.08, hold: 0.35, decay: 0.5, gain: 0.45 });
    },
    // the broadcast's intro sting
    sting() {
      if (!ensure()) return;
      const notes = [261.63, 329.63, 392.0, 523.25];
      notes.forEach((f, i) => {
        tone({ freq: f, type: "sawtooth", attack: 0.4, decay: 2.4, gain: 0.06, when: i * 0.06 });
        tone({ freq: f * 2, type: "triangle", attack: 0.2, decay: 1.6, gain: 0.04, when: 0.5 + i * 0.12 });
      });
      tone({ freq: 65.4, type: "sine", attack: 0.05, decay: 1.8, gain: 0.3 });
      burst({ freq: 5000, type: "highpass", attack: 0.6, decay: 0.8, gain: 0.08 });
    },
    // spoken commentary (cancels whatever is being said when `now`)
    say(text, { now = false } = {}) {
      if (!on || !speech || !text) return;
      if (now) speech.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.lang = voice?.lang || "en-GB";
      u.rate = 1.06;
      u.pitch = 1;
      u.volume = 1;
      speech.speak(u);
    },
    stopTalking() {
      speech?.cancel();
    },
    dispose() {
      speech?.cancel();
      speech?.removeEventListener?.("voiceschanged", pickVoice);
      ctx?.close().catch(() => {});
      ctx = null;
    },
  };
  return api;
}

// ---------- commentary lines ----------
const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
const seedOf = (s) => [...String(s || "x")].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

// Line spoken when the moment's big moment happens (the first burst of its clip).
export function commentaryLine(m) {
  const p = m?.play || {};
  const s = p.striker || p.out || "the batter";
  const b = p.bowler || "the bowler";
  const f = p.fielder || "the fielder";
  const k = seedOf(m?.id || m?.title);
  const title = String(m?.title || "").toUpperCase();
  switch (m?.kind) {
    case "six":
      return pick([`${s} launches it! That's a massive six!`, `Into the stands! Six runs for ${s}!`, `Up, up and away... that's six!`, `That has gone all the way! What a hit from ${s}!`], k);
    case "four":
      return pick([`Cracking shot from ${s}, four runs!`, `That races away to the boundary. Four!`, `Beautifully timed, and that's four more.`, `No stopping that one! Four runs to ${s}.`], k);
    case "wicket": {
      const how = p.how;
      if (how === "b") return pick([`Bowled him! The stumps are shattered!`, `Timber! ${b} knocks him over!`], k);
      if (how === "c") return pick([`In the air... and taken! ${s} has to go.`, `Caught! Good catch from ${f}.`], k);
      if (how === "cb") return `Caught and bowled! Brilliant reflexes from ${b}!`;
      if (how === "lbw") return `Big appeal... and given! ${s} is out leg before wicket.`;
      if (how === "st") return `Stumped! Lightning quick work behind the stumps.`;
      if (how === "ro") return `Yes, no, wait... direct hit! He's run out!`;
      if (how === "hw") return `Oh dear! He's trodden on his own stumps. Hit wicket!`;
      return pick([`Gone! That's the end of ${s}.`, `Wicket! ${b} strikes!`], k);
    }
    case "catch":
      return pick([`What a catch! Absolutely brilliant from ${f}!`, `Oh, he's plucked that out of thin air!`], k);
    case "drop":
      return pick([`Oh, he's dropped it! That's a life for ${s}.`, `Put down! The crowd can't believe it.`], k);
    case "wide":
      return pick([`That's well wide. The umpire stretches the arms.`, `Wide again! The bowler's lost his radar.`], k);
    case "noball":
      return `No ball! Over-stepped, and that means a free hit.`;
    case "freehit":
      return `Free hit... and he's missed out!`;
    case "milestone":
      return title.includes("HUNDRED") ? `Raise the bat! A magnificent hundred for ${s}!` : `That brings up the fifty! Well played, ${s}.`;
    case "result":
      return `And that's the match! What a performance!`;
    case "star":
      return title.includes("HAT-TRICK") ? `Hat-trick! Unbelievable from ${b}!` : `What a spell of bowling from ${b}!`;
    default:
      return "";
  }
}
// Said as the bowler runs in (only for longer clips, so it doesn't talk over the action).
export function runUpLine(m) {
  const p = m?.play || {};
  if (!p.bowler || !p.striker) return "";
  const k = seedOf(m.id);
  return pick([`${p.bowler} runs in to ${p.striker}...`, `${p.bowler} to ${p.striker}...`, `Here's ${p.bowler}...`], k);
}
export function welcomeLine(ground, date, title) {
  const when = date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  return `Hello and welcome to ${ground.name}, ${ground.city.split(",")[0]}, on ${when}. Here are the highlights of ${title}.`;
}
