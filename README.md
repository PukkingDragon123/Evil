# 🎤 RAP BATTLE — Freestyle to the Beat

A browser rap-battle game. A beat drops, you get **4 blocks of words**, and you
freestyle into your mic. An "AI judge" scores your **Accuracy**, **Beat**, and
**Lyrical** skill in real time. No installs, no API keys, no audio files — the
beat is synthesized live with the Web Audio API and your voice is read with the
Web Speech API.

![rap battle](https://img.shields.io/badge/play-in%20your%20browser-ff2e88)

## How to play

1. Hit **GRAB THE MIC** and allow microphone access.
2. You get **4 blocks**:
   - **BAR 1–3** → seed words to weave into your bars.
   - **PUNCHLINE** → the word your final line must **rhyme with**.
3. On `GO!` the beat starts. Spit your verse over 8 bars — words light up as you
   land them, and the punchline block glows when you nail a rhyme.
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
