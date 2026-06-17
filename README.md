# 🕹️ EVIL ARCADE

Two self-contained browser games. **No installs, no build step, no API keys,
no servers** — open the page and play. Everything (camera, mic, audio, scoring)
runs client-side; nothing ever leaves your device.

| | Game | What it is |
|---|------|-----------|
| 🥊 | **[Shadow Boxer Ultimate](shadow-boxer/)** | Camera shadow-boxing — throw real punches, block, slip, KO bots & friends |
| 🎤 | **[Rap Battle](rap-battle/)** | Freestyle to a live-synthesized beat while an "AI judge" scores you |

Open `index.html` for the arcade hub, or jump straight into a game's folder.

---

## 🥊 Shadow Boxer Ultimate

A **camera-based shadow-boxing game**. Your webcam is the ring: punch the
targets that pop up, **hold still and cover** to block, and **lean** to slip
the bot's shots. Build combos, drop opponents, and style on 'em.

> No camera? It auto-falls back to **keyboard / on-screen buttons** so you can
> still play (A / L to punch, Space to guard, ← / → to slip).

### Modes

- 🥊 **Quick Fight** — *queue up* and get matched against a **bot** (each with a
  gamertag, style and trash talk). Three rounds, KO to win early.
- 🎯 **Train** — free hitting on the heavy bag. Rack up combos and damage, no
  pressure — great for warming up and farming SPIN.
- 🤝 **Fight Friends** — **pass-the-camera** local 1v1. Both fighters face the
  *same opponent and the exact same sequence* (seeded), and the **top score
  wins**.

…at three difficulties — **Rookie / Pro / Champ** — which change the bot's HP,
damage, aggression, how fast targets come and how tight the defense windows are.

### SPIN & the gear shop

You earn **SPIN** from fights, training and especially **Quests** (daily
challenges like "land 40 punches", "hit a 12× combo", "win by KO"). Spend it in
**Style & Gear**:

- 🥊 **Boxing styles** *(gameplay)* — Orthodox, Swarmer, Out-Boxer, Slugger,
  Counter-Puncher, Southpaw. Each tunes target timing, power, combo growth,
  defense windows and counter damage.
- 🧤 **Glove filters** *(cosmetic)* — colour your on-screen gloves & hit sparks
  (Classic Red, Champion Gold, Galaxy, Inferno, Frostbite…).
- 💥 **KO "kill" effects** *(cosmetic)* — the finisher splash when you drop an
  opponent (Star Burst, Lightning, Inferno, Confetti, Glitch…).
- 🏟️ **Arenas** *(cosmetic)* — backdrop + UI accent (The Gym, Vegas, Neon
  Rooftop, Title Arena).

Progress (SPIN, gear, equipped loadout, stats and quest state) is saved to
`localStorage`, and you climb **belt ranks** from Amateur → Undisputed as you
win.

### How the camera works

There's **no ML model and no network** — it's pure frame-differencing:

- Each webcam frame is drawn to a tiny hidden canvas and diffed against the last
  one to build a **motion grid**.
- The fight engine asks "how much movement is in *this* region right now?" to
  decide if you hit a target; **stillness** registers a block; strong **side
  motion** registers a slip.
- The strongest motion in each half of the frame becomes your **left/right
  glove**, rendered with whatever glove filter you've equipped.

> 🎥 Step back so your **upper body fills the frame**, give the camera good
> light, and throw real punches. Best in **Chrome / Edge**.

### Run it

The camera needs a **secure context**, so serve over `localhost` (or HTTPS)
rather than opening the file directly:

```bash
# from the repo root
python3 -m http.server 8000
# then open http://localhost:8000/shadow-boxer/   (or just /  for the hub)
```

Any static server works (`npx serve`, `php -S localhost:8000`, …).

### Project layout

```
shadow-boxer/
  index.html        # screens: home → shop / quests / matchmaking / friends → fight → result
  css/style.css     # ring-night theme + fight HUD, cues, KO effects
  js/data.js        # styles, gloves, KO FX, arenas, ranks, bots, quest board
  js/store.js       # localStorage: SPIN, inventory, equipped gear, stats, quests
  js/audio.js       # Web Audio SFX (impacts, bell, crowd, KO) + hype loop
  js/vision.js      # webcam motion detection + glove rendering + keyboard fallback
  js/quests.js      # quest progress + SPIN payouts
  js/engine.js      # the fight: targets, block/slip cues, bot AI, combos, KO
  js/game.js        # screen state machine + fight HUD wiring
```

---

## 🎤 Rap Battle

A browser **rap-battle game**. A beat drops, you get blocks of words, and you
freestyle into your mic while an "AI judge" scores your **Accuracy**, **Beat**
and **Lyrical** skill in real time. Solo, 1v1 pass-the-mic, or set custom words
for a friend. See **[rap-battle/](rap-battle/)** for full details.

---

Built to be hacked on — tweak the `data.js` catalogs, the tuning constants in
`engine.js`, or the scoring weights in Rap Battle's `score.js` to make it your
own. 🥊🎶
