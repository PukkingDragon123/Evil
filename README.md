# 🎤 RAP BATTLE — Freestyle to the Beat

A browser rap-battle game. A beat drops, you get **4 blocks of words**, and you
freestyle into your mic. An "AI judge" scores your **Accuracy**, **Beat**, and
**Lyrical** skill in real time. No installs, no API keys, no audio files — the
beat is synthesized live with the Web Audio API and your voice is read with the
Web Speech API.

![rap battle](https://img.shields.io/badge/play-in%20your%20browser-ff2e88)

## Modes

- 🎤 **Solo Cypher** — just you vs. the beat.
- ⚔️ **1v1 Local** — pass-the-mic battle. Each player gets their own bars, then a
  **versus scoreboard** crowns the winner.
- ✏️ **Custom** — type your own set of words (the **last word is the punchline**)
  and hand the device to a friend to surprise them.

…each at three difficulties — **Easy / Normal / Hard** — which change the BPM,
the number of bars, how many required words you get, and how strict the judge is.

## Leaderboard

Scores save to a **local leaderboard** (stored in your browser via
`localStorage`). Drop your MC tag after a solo/custom verse, or save both
players after a 1v1, and climb the board on the 🏆 screen. It's per-device — no
account, no network.

## How to play

1. Pick a **difficulty** and a **mode** on the home screen, then allow mic access.
2. Bars scroll across a **moving lane** toward the center line. Most are
   `FREESTYLE`; some carry a **required word**; the last one is the **PUNCHLINE**
   you must rhyme with.
3. A **checklist** tracks the required words — they tick green as you land them,
   and the punchline turns gold when you nail a rhyme.
4. When the beat ends (or you hit **END VERSE**), the judge scores you:

| Score | What it measures |
|-------|------------------|
| 🎯 **Accuracy** | How many of the target/seed words + the punchline you actually hit |
| 🥁 **Beat** | Mic timing vs. the beat grid — coverage, tightness, and consistency |
| ✍️ **Lyrical** | Punchline rhymes landed, internal rhyme density, vocabulary, and flow |

Rack up enough and climb from **STAGE FRIGHT 😬** to **LEGENDARY 👑**.

## Running it

The microphone and speech APIs require a **secure context**, so serve it over
`http://localhost` (or HTTPS) rather than opening the file directly:

```bash
# from the project root
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve`, `php -S localhost:8000`, etc.).

### Browser support

- **Speech recognition** (live lyrics) works best in **Chrome / Edge**. In
  browsers without it (e.g. Firefox/Safari), the game falls back to a text box
  where you can type your bars — the beat and scoring still work.
- The synthesized beat and mic-energy / beat scoring work in any modern browser.

## Project layout

```
index.html        # screens: title → play → result
css/style.css     # neon "booth" theme + beat-synced animations
js/words.js       # themed word banks + punchline rhyme families
js/audio.js       # Web Audio beat engine + mic analyser (energy/timing capture)
js/speech.js      # Web Speech API wrapper (live transcript)
js/score.js       # the "AI judge": accuracy / beat / lyrical scoring + ranks
js/game.js        # state machine + UI wiring
```

## How the "AI judge" works

It's a transparent heuristic engine (runs fully client-side, no network):

- **Rhyme detection** maps each word to a canonical "rhyme sound" key — major
  families (`-ire`, `-ight`, `-ow`, `-ime`, …) are matched explicitly so
  near-rhymes like *fire / higher / liar* count, while *fire / concrete* don't.
  Each punchline also ships with a curated rhyme family for reliable hits.
- **Beat** is read from the live mic: vocal onsets are compared against the
  eighth-note grid of the generated beat for timing, plus coverage (did you rap
  the whole time?) and consistency (steady flow?).
- **Lyrical** rewards landing punchline rhymes, internal rhyme density,
  vocabulary richness, and packing enough words into the bars.

Tweak the word banks in `js/words.js` or the scoring weights in `js/score.js` to
make it your own. 🎶
