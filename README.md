# 🐟 Plenty Fish in the Sea 🪷

A calm, top-down **3D koi breeding game** set in a sunlit Japanese zen pond,
with a wood-and-washi dojo interface.
Buy koi, pair them, and breed across generations — mixing **genes**, chasing
**mutations**, and discovering real koi **subspecies**. Your goal is simple:
raise as many fish as you possibly can, and breed the most beautiful ones.

Built with vanilla JavaScript + a vendored copy of **Three.js**. No build step,
no install, no external dependencies at runtime.

---

## ▶️ Play

The game is plain static files, so any static host works.

**Locally:**

```bash
# from the project root
python3 -m http.server 8080
# then open http://localhost:8080
```

(Opening `index.html` directly via `file://` will not work — ES modules need to
be served over `http(s)`. Any static server is fine.)

It also runs directly from a GitHub static-CDN such as
[`raw.githack.com`](https://raw.githack.com), which serves the files with the
correct MIME types so the import map and modules load as-is.

---

## 🎮 How to play

Koi are precious — you get them two ways: the **Market** and **breeding**.

- **🏮 Market (市場)** — three koi arrive each minute, each with its own traits,
  rarity and price. Buy the bloodlines you want before they refresh.
- **🙇 Visitors (客)** — buyers drop by seeking a particular variety or trait
  (a Kohaku, a 4★ koi, Veil fins, sumi, a metallic koi…) and pay a **premium**.
  Fulfilling their requests is your steadiest income.
- **🐟 Tap a koi** to inspect its genes, value and income; tap a second to
  **pair** them.
- **🧬 Breeding Cave (繁殖の洞)** — pick a pair and study the **simulated odds**
  of each variety, the quality spread and the chance of a brand-new trait, then
  breed. Offspring blend both parents' genes with occasional **mutations**.
- **🍃 Shop (店)** — enlarge the pond and feed special foods: more income, faster
  breeding, finer broods, or more frequent visitors.
- **⛩️ Build (普請)** — buy lanterns, torii gates, bridges, pagodas, trees, ducks,
  snails and more, then **tap the garden** to place them (tap again in *remove
  mode* to sell a piece back).
- **📖 Koi-dex (図鑑)** — discover all the real koi varieties (Kohaku, Tancho,
  Showa, Ogon, Asagi, Kumonryu, Butterfly…).
- **🌦️ Weather** drifts from sun to sakura petals to rain. 🦆 Ducks paddle and
  🐌 snails roam. Drag to look around, scroll to zoom, tap the water for ripples.

Progress saves automatically, and your koi keep earning (a little) while away.

---

## 🧬 The genetics

Every koi carries a **genome** of 14 genes (colour, pattern, fins, sumi
markings, size, lustre, metabolism, fertility, vigour…). The genome is expressed
into a visible **phenotype**, which is then:

- **classified** into a named subspecies by trait predicates,
- **scored** for quality → stars, sale value and passive income.

Breeding blends parents gene-by-gene (hues blend around the colour wheel) and
applies small Gaussian mutations, with rare larger "sport" mutations that
introduce genuinely new traits — so selective breeding really does converge on
better fish over generations.

---

## 🗂️ Project structure

```
index.html            # entry point + Three.js import map
styles.css            # zen UI styling
vendor/three.module.js# vendored Three.js r160 (self-contained)
src/
  config.js           # all gameplay/balance tunables
  main.js             # bootstrap, input, build mode, market/offer ticks, loop
  game/
    genetics.js       # genome, inheritance, mutation, subspecies, market synthesis, breeding sim
    state.js          # pond, economy, market, offers, foods, decorations, save/load
    market.js         # market listings & buyer-offer generation/matching
    foods.js          # food catalog (temporary buffs)
    decorations.js    # decoration catalog (building system)
  scene/
    pondScene.js      # renderer, camera, lights, fish movement, build placement
    koiFish.js        # slim procedural koi (eyes, fins, barbels) + swim shader
    water.js          # stylised translucent water shader
    ripples.js        # tap ripples & droplet particles
    garden.js         # raked sand, rocks, lily pads, lotus, reeds, trees
    critters.js       # ducks (with wakes) & snails
    weather.js        # sun / petals / cloud / rain cycle
    decor.js          # decoration models + placement manager
  ui/
    ui.js             # HUD, Market, Visitors, Breeding Cave, Shop, Build, Koi-dex
    toast.js          # transient notifications
test/                 # Node tests (no browser needed)
```

---

## ✅ Tests

The game logic (genetics + economy) and the 3D builders are covered by
dependency-free Node tests:

```bash
node test/genetics.test.js     # genome / inheritance / subspecies / scoring
node test/systems.test.js      # market synthesis / breeding odds / offers / catalogs
node test/state.test.js        # economy / market / offers / foods / decor / save-load
node test/visual.smoke.mjs     # builds koi/water/critters/weather/decor vs real Three.js
```

> The visual smoke test resolves `three` via a tiny `node_modules/three` shim
> that re-exports the vendored build; that folder is git-ignored.

Enjoy your pond. 🌿
