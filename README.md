# Player Info — React

Cricket squad manager built with Vite, React 19, React Router and lucide-react.
It replaces the original SAP UI5 app: the XML views and controllers are now JSX components.
The old UI5 sources are kept in `_ui5-backup/` for reference.

```bash
npm install
npm run dev      # start dev server (opens browser)
npm run build    # production build into dist/
```

Demo login: `admin` / `1234`

## UI5 → React mapping

| UI5 (old)                                         | React (new)                                  |
| ------------------------------------------------- | -------------------------------------------- |
| `webapp/index.html`, `Component.js`               | `index.html`, `src/main.jsx`                 |
| `manifest.json` routing                           | `src/App.jsx` (React Router)                 |
| `view/App.view.xml` + controller                  | `src/App.jsx`, `src/components/Layout.jsx`   |
| `view/Login.view.xml` + `Login.controller.js`     | `src/view/Login.jsx`, `src/context/AuthContext.jsx` |
| `view/Dashboard.view.xml` + controller            | `src/view/Dashboard.jsx`                     |
| `view/Players.view.xml` / `View1.view.xml`        | `src/view/Players.jsx`                       |
| `view/PlayersDetails.view.xml` + controller       | `src/view/PlayerDetails.jsx`                 |
| `model/players.json` (JSONModel)                  | `src/model/players.json`, `src/context/PlayersContext.jsx` |
| `css/style.css`                                   | `src/styles.css`                             |

## Features
- **Login** with protected routes (session-based)
- **Dashboard**: squad size, total runs/wickets, role breakdown, top scorers and wicket takers
- **Players**: search, filter by role, sort, grid/list view, add new players
- **Player details**: profile, stats, edit and delete

Edits are saved in the browser's localStorage. Use **Reset** on the Players page to restore the original list.

## Match highlights
Every match gets a highlights reel ([src/lib/highlights.js](src/lib/highlights.js)):
- **Ball-by-ball (live-scored) matches:** every wicket, four and six with commentary, fifties/hundreds,
  partnerships, back-to-back sixes, two-in-two / hat-tricks, maidens, last-over thrillers, plus funny
  moments: golden ducks, ducks, out on 49 / in the 90s, hit wicket, run-out mix-ups, "hero to zero"
  (six then out), four byes, six off a no-ball, 3+ wides in an over, 20+ run overs.
- **Typed scorecards / seed series:** fifties, top scores, blitzes, sixes, fours, 3-fors / five-fors,
  safe hands, ducks, expensive spells, and "Mr Extras top-scores".
- **Your own moments:** "Add a moment" (funny moment, great catch, dropped catch, other), saved on the device.

Shown on the match page (Schedule → match), under **Highlights** on each Matches card, and on the
Dashboard as **Recent match highlights** (last 3 matches) plus the latest match's best and funniest
moment in the top carousel.

### 3D highlights video
Press **Play highlights** on any highlights reel (or tap a moment's icon) to watch the match acted
out in a 3D stadium, TV-style: stadium fly-in, bowler run-up and full bowling action, two-handed
batting shots (drive, loft, pull, defend, leave), ball flight with drag and trail, fielders chasing,
diving, catching, dropping and throwing, umpire signals (out, four, six, wide, no ball, free hit, bye),
slow-motion replays from a second camera (batter cam, stump cam, side-on, front-foot no-ball cam),
a crowd that cheers on big moments, a big screen, scorebug, celebrations, confetti, and a duck that
follows the batter off after a duck.

Built with three.js in [src/replay/](src/replay/):
- `world.js`: stadium (two tiers, roof, floodlights, LED boards, big screen, GPU-animated crowd),
  mown outfield, worn pitch with painted creases, sun shadows.
- `player.js`: rigged characters (pelvis/spine/chest/neck/head, shoulders/elbows/hands,
  hips/knees/ankles) with blended poses, running gait, 2-bone arm IK (hands on the bat / on the
  ball), kits with name + number.
- `clips.js`: one script per kind of moment, replays and clip sequencing.

The player is [HighlightPlayer.jsx](src/components/HighlightPlayer.jsx), loaded only when played.
Keys: Space play/pause, ←/→ previous/next, F full screen, Esc close. Works offline.

### Your own match videos (real footage)
Every highlight in a match's list has a **camera button**: choose or record the phone video of that
six, wicket or catch, then set **Start**, **Big moment** and **End** (the "Here" buttons use the
video's current position). In the highlights video those moments play your real footage, with:
- the scorebug, ground, date and a **MATCH VIDEO** tag,
- a lower-third card with the player's **name and jersey number**,
- the TV graphic at the big moment (SIX!, FOUR!, CAUGHT!, BOWLED!, DROPPED!…), crowd roar and commentary,
- a **slow-motion replay** of the big moment.

Highlights without a video still play in 3D, and the setup screen can switch videos off. Videos are
kept in IndexedDB on this device ([src/lib/videoClips.js](src/lib/videoClips.js)): they work offline but
aren't copied to other devices. MP4 (H.264) plays everywhere; some iPhone HEVC .mov files only play in
Safari (the video skips to the next highlight if the browser can't play it).

### 3D models per player
Rigged human models (.glb / .fbx, e.g. Mixamo characters) are kept in a **model library** on the
device. Choose one for everyone on the setup screen (**Players**), and give any player their own in
the player editor (**Look in the 3D highlights video → 3D model**: same as everyone, built-in, or a
library model). Each player's model gets the team kit colours, the name + number on the back, pads,
helmet, gloves and bat.

### Picture quality and frame rate
[src/replay/pipeline.js](src/replay/pipeline.js) renders the video like a TV picture: bloom on the lights,
a broadcast colour grade with vignette and fine grain, SMAA anti-aliasing, soft studio reflections on
every material, shadows that tighten around the action on close-ups, fabric sheen + weave on kits,
lacquered helmets and shoes, and fine grass / pitch surface detail ([src/replay/textures.js](src/replay/textures.js)).
The **gear button** in the video picks the quality:
- **Auto** (default): lowers the resolution, then the effects, when the device can't hold ~60 fps, and
  raises them again when it can.
- **Performance**, **High**, **Ultra** (adds ambient occlusion and depth of field on close-ups).
- **Show frame rate** displays the FPS and what's running.
Between highlights and into replays the video plays a team-coloured broadcast wipe; the scorebug shows
the batting team's colour. On phones the video fills the screen with larger controls.

### Character creator (every player + the umpire)
Players → edit a player → **Customize character** opens a full-screen creator with a 3D preview
(drag to turn; Body / Face / Shoes camera; preview Fielding or Batting) and tabs:
- **Face:** skin tone, face shape (oval, round, square, long, slim), eye colour, eyebrows, nose.
- **Hair & beard:** short, buzz cut, curly, long, spiky, bald; hair colour; clean shaven, stubble,
  short or full beard, goatee, moustache.
- **Cap, glasses & shoes:** fielding headwear (cap, backwards cap, sun hat, headband, nothing) and its
  colour, helmet colour, sunglasses (sports wraparound, aviators, round) and lenses (dark, blue or gold
  mirror, clear), shoe colour and stripe, wristbands. "Team colour" follows the team kit.
- **Body & shirt:** build, height, **jersey number**, name on the shirt, and the 3D model.
**Randomize** and **Reset** are there too. The **umpire** is customized from the highlights setup
screen (**Customize umpire**): face, hair, hat (wide-brim, cap, none), shirt and trousers colours,
glasses and shoes; saved on the device.

### Player characters and their looks
- The built-in cricketers have one smooth, skinned body ([src/replay/body.js](src/replay/body.js)):
  trunk, neck, arms and legs bend at the joints instead of being separate pieces. Shirt (with the kit
  print), sleeves with cuff trim, bare arms and trousers are parts of the same mesh.
- Each squad player has a **look** ([src/replay/look.js](src/replay/look.js)): skin tone, hair style and
  colour, beard, build and height. Edit it under **Look in the 3D highlights video** in the player
  form (Players page or match setup), with a turning 3D preview (click it to zoom on the face).
  Players who haven't been edited get a stable look made from their name.
- In the video, the batters, bowler and fielders are the real squad players: their names, **jersey
  numbers** and looks (the keeper is the squad's wicket-keeper).

### TV coverage, commentary and sound
- Shots: bowler run-up close-up, broadcast view, ball-following and **spider-cam** shots, batter close-up,
  **crowd cutaways**, umpire's decision zoom, slow-motion replay, a **super slow-mo** of bat on ball,
  and **Hawk-Eye** ball tracking for LBWs (path, pitching, impact, "wickets: hitting").
- Sound ([src/replay/audio.js](src/replay/audio.js)): crowd murmur that rises with the action, roars for
  sixes, fours and wickets, the crack of the bat, rattling stumps and an intro sting, all generated in
  the browser (no sound files, works offline).
- Commentary is spoken with the device's own text-to-speech voices (an Indian or British English voice
  when available): the welcome, the bowler running in, and a line for each six, four, wicket, catch,
  drop, wide or no-ball. The speaker button turns sound and commentary off (remembered on the device).

### Choose the ground, day and players
**Play highlights** first opens a match setup screen:
- **Ground:** 41 grounds from 14 countries (India, Australia, England, Pakistan, South Africa,
  New Zealand, Sri Lanka, Bangladesh, West Indies, UAE, Afghanistan, Zimbabwe, Ireland, Netherlands).
  Filter by country or search. If the match's venue names one of them, it's picked for you.
  Each ground has its own look ([src/replay/grounds.js](src/replay/grounds.js)): a two-tier bowl,
  one main stand, or an open ground with grass banks and trees; seat and roof colours; a home crowd in the
  country's colours; mowing pattern (stripes, checks, circles); pitch colour; and landmarks such as a
  city skyline, mountains (Cape Town's table mountain, Dharamsala's snow peaks), the sea, Galle's fort,
  a members' pavilion. They are themed impressions, not exact models of the real stadiums.
- **Match day:** date and time (the match's own, or now), and the light: day, day/night or night under
  floodlights (stars, glowing towers, lit city windows).
- **Players:** built-in cricketers or your own 3D model.

The video then opens with a stadium fly-in and **"Welcome to <ground>"**, with the city, country flag,
date and time. The ground name and date stay in the top bar; the pin button goes back to the setup.
The last ground picked is remembered on the device.

### TV-style kits and umpire decisions
- **Kits:** team name across the chest, crest on the left chest, V-neck collar, side panels and sleeve
  trim in the team's second colour, and the player's **name + number on the back**. Batters' helmets
  carry the team badge. Loaded character models get the name + number printed on their back too.
- **Faces:** painted faces (eyes, brows, nose, lips, some with stubble/beards) with a modelled nose,
  jaw and brow.
- **Umpire's decision:** after every six, four, wicket and wide, the video cuts to the umpire and zooms
  in while the signal is given (finger up for OUT, both arms for SIX, waving arm for FOUR, arms out for
  WIDE), then the slow-motion replay plays.
- **Hero shot:** after a six (and a four) the camera goes to a close-up of the batter, bat raised, with
  the crowd behind.

### Realistic player characters (your own 3D model)
The built-in players are made in code. For game-style realistic players, use a rigged human model:
- **In the app:** open a highlights video → the **person icon** → **Choose model…** → pick a `.glb` or `.fbx`.
  It's checked, saved on the device (Cache Storage, works offline) and used for every batter, bowler,
  fielder and umpire. **Use built-in** switches back.
- **For everyone who uses the app:** put the file in `public/models/cricketer.glb` (or `.fbx`). Several
  models can be listed in `public/models/models.json`:
  `{ "players": ["player1.glb", "player2.glb"], "umpire": "umpire.glb" }`.

Any humanoid rig works: Mixamo (`mixamorig:Hips`, `LeftArm`…), Ready Player Me-style and Unreal-style
(`pelvis`, `upperarm_l`…) bone names. [src/replay/models.js](src/replay/models.js) turns the model
to face the camera, scales it, lowers the arms from the T-pose, and re-fits the code rig to the model's
proportions, so every animation, bat grip and catch drives the model's own bones. Pads, helmet,
gloves, cap and bat are added on top. Materials named like *shirt / jersey / top* and *pants / trousers*
get the team colours.

A free option: [Mixamo](https://www.mixamo.com) (free Adobe account) → Characters → pick a sporty one →
Download → Format **FBX Binary**, Pose **T-pose**. You can't use characters taken from commercial games;
they belong to their publishers.

### No ball → free hit
Live scoring tracks free hits: after a no-ball the next legal ball shows a **FREE HIT** badge
(it carries over wides and further no-balls) and the wicket sheet only allows run out. Commentary,
highlights ("FREE HIT · SIX", "Free hit wasted", "No ball") and the 3D replay (front foot over the
line, umpire's arm out, then the circling free-hit signal) all follow it.

### Highlights from typed-in scorecards
Matches entered as a scorecard (and the seed series) get a rebuilt ball-by-ball match
([src/lib/reconstruct.js](src/lib/reconstruct.js)): every batter's runs, balls, 4s, 6s and dismissal
(bowler / fielder) match the card exactly; only the order of the balls is invented. Those moments
are labelled "rebuilt from scorecard", and sequence-based ones (hat-tricks, expensive overs…) are
skipped so nothing is made up.

## Offline / online
The app works with or without internet.
- All data (players, fixtures, live scores) lives in localStorage, so it never needs a server.
- A service worker (generated by `vite.config.js` as `dist/sw.js`) caches the app on first visit. Later visits open even with no connection, including deep links such as `/players/3`.
- When online, pages load fresh from the network and the cache updates. Each new build replaces the old cache automatically.
- An **Offline** badge shows while there is no connection. The app can be installed ("Add to Home screen" / "Install app").
- The service worker runs only in production builds (`npm run build` + `npm run preview`, or your host). `npm run dev` stays uncached.
- To test: open the built app once, then in DevTools → Network choose **Offline** and reload.
