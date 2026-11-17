// Auto-generated ball-by-ball commentary. Lines are picked deterministically from a phrase
// bank (same ball → same line), and use the shot direction when the scorer tapped one.
import { DISMISSALS } from "./scoring.js";
import { ZONES } from "./wagon.js";

// Zone for a tapped angle (degrees clockwise from straight). Left-handers see a mirrored field.
export function zoneFor(shot) {
  if (!shot) return null;
  const a = ((shot.left ? 360 - shot.a : shot.a) % 360 + 360) % 360;
  return ZONES.find((z) => a >= z.from && a < z.to) || ZONES[0];
}

const pick = (list, seed) => list[Math.abs(seed) % list.length];
const where = (zone, deep) => {
  if (!zone) return "";
  const n = zone.name.toLowerCase();
  return deep ? `over ${n}` : `towards ${n}`;
};

const DOT = [
  "good length, defended solidly back down the pitch.",
  "beaten! Lovely delivery that just leaves the edge.",
  "full and straight, blocked with a firm bat.",
  "short of a length, left alone outside off.",
  "tight line, no room to free the arms. Dot ball.",
  "pushed to the fielder in the ring, no run.",
];
const SINGLE = [
  "worked {where} for a single.",
  "nudged {where}, they scamper through for one.",
  "soft hands, dropped {where} and they take a quick single.",
  "tucked {where}, easy single.",
];
const TWO = [
  "pushed into the gap {where}, they come back for two.",
  "placed {where}, good running between the wickets gets them {runs}.",
  "driven {where}, the fielder chases and they get {runs}.",
];
const FOUR = [
  "FOUR! Driven beautifully {where}, the fielder doesn't move.",
  "FOUR! Short and punished, cracked {where}.",
  "FOUR! Timed to perfection {where}, races to the rope.",
  "FOUR! Finds the gap {where}, one bounce into the boundary.",
  "FOUR! Width offered and {s} cuts hard {where}.",
];
const SIX = [
  "SIX! Launched {where}, that's gone a long way!",
  "SIX! Down the track and lofted {where}. Huge hit!",
  "SIX! Picked the length early and cleared the rope {where}.",
  "SIX! Pure power, deposited {where} into the crowd.",
];
const WIDE = ["wide, drifting down the leg side.", "wide, too far outside off.", "wide called, the bowler loses the line."];
const NOBALL = ["no ball! Overstepped. Free hit coming.", "no ball, height above the waist.", "no ball called, the bowler has overstepped."];
const OUT = {
  b: ["BOWLED! Through the gate and the stumps are rattled!", "BOWLED HIM! Off stump cartwheeling!", "BOWLED! Played all around it."],
  c: ["OUT! Caught by {f}! Went for the big one and didn't get enough.", "OUT! Edged and taken by {f}!", "OUT! Holes out to {f}, a simple catch."],
  cb: ["OUT! Caught and bowled! Sharp reflexes from {bw}.", "OUT! Chips it back and {bw} takes a smart return catch."],
  lbw: ["OUT! LBW! Trapped in front, the finger goes up.", "OUT! Plumb LBW, missed the line completely."],
  st: ["OUT! Stumped by {f}! Down the track, beaten in flight.", "OUT! Lightning glovework from {f}, stumped!"],
  ro: ["OUT! Run out! Brilliant work from {f}.", "OUT! Mix-up in the middle and {out} is run out! {f} with the throw."],
  hw: ["OUT! Hit wicket! Treads on the stumps."],
  rh: ["{out} retires hurt and walks off."],
  ret: ["{out} retires out."],
};

const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

// One commentary line for a replayed ball (see live.js `log`).
export function commentLine(entry) {
  const { e, idx, bat } = entry;
  const zone = zoneFor(e.shot);
  const v = {
    s: e.striker, bw: e.bowler, f: e.wicket?.fielder || "", out: e.wicket?.out || "", runs: e.runs,
    where: where(zone, e.runs === 6),
  };
  const seed = idx * 7 + (e.striker?.length || 0) * 13 + (e.bowler?.length || 0);
  let text;
  let tone = "run";
  if (e.wicket) {
    tone = "w";
    text = fill(pick(OUT[e.wicket.how] || OUT.c, seed), v);
    if (DISMISSALS[e.wicket.how]?.[3]) text += ` ${e.wicket.out} ${entry.outScore ? `${entry.outScore.runs} (${entry.outScore.balls})` : ""}.`;
  } else if (e.extra === "wd") {
    tone = "x";
    text = pick(WIDE, seed) + (e.runs ? ` They run ${e.runs} as well.` : "");
  } else if (e.extra === "nb") {
    tone = "x";
    text = pick(NOBALL, seed) + (e.runs ? ` ${e.runs === 6 ? "And it's SIX off the no ball!" : e.runs === 4 ? "And FOUR off the no ball!" : `${e.runs} off the bat too.`}` : "");
  } else if (e.extra === "b" || e.extra === "lb") {
    tone = "x";
    text = `${e.runs} ${e.extra === "b" ? "bye" : "leg bye"}${e.runs > 1 ? "s" : ""}${e.extra === "lb" ? ", off the pad" : ", past the keeper"}.`;
  } else if (e.runs === 0) {
    tone = "dot";
    text = pick(DOT, seed);
  } else if (e.runs === 4) {
    tone = "four";
    text = fill(pick(FOUR, seed), v);
  } else if (e.runs === 6) {
    tone = "six";
    text = fill(pick(SIX, seed), v);
  } else if (e.runs === 1) {
    text = fill(pick(SINGLE, seed), v);
  } else {
    text = fill(pick(TWO, seed), v);
  }
  if (entry.fh) text = `FREE HIT! ${text}`;
  text = text.replace(/\s+([.,!])/g, "$1").replace(/ {2,}/g, " ").trim();
  const result =
    e.wicket ? "W" : e.extra === "wd" ? `${e.runs + 1} wd` : e.extra === "nb" ? `${e.runs + 1} nb` : e.extra ? `${e.runs} ${e.extra}` : `${e.runs}`;
  const milestones = [];
  if (bat && !e.wicket) {
    const before = bat.runs - (e.extra ? (e.extra === "nb" ? e.runs : 0) : e.runs);
    for (const m of [50, 100, 150])
      if (before < m && bat.runs >= m) milestones.push(`${m === 50 ? "FIFTY" : m === 100 ? "HUNDRED" : `${m} UP`} for ${e.striker}! ${bat.runs} off ${bat.balls} balls.`);
  }
  if (entry.partnershipMilestone) milestones.push(`${entry.partnershipMilestone}-run partnership up.`);
  return { head: `${e.bowler} to ${e.striker}`, text, tone, result, milestones, zone: zone?.name || "" };
}

// Summary card text at the end of an over.
export function overSummary(o) {
  const parts = [`${o.runs} run${o.runs === 1 ? "" : "s"}`];
  const w = o.balls.filter((b) => b.wicket && DISMISSALS[b.wicket.how]?.[3]).length;
  if (w) parts.push(`${w} wkt${w > 1 ? "s" : ""}`);
  return parts.join(" · ") + (o.runs === 0 && o.balls.length >= 6 ? " · MAIDEN" : "");
}
