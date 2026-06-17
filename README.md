# 🐟 Plenty Fish in the Sea 🪷

A calm, top-down **3D origami koi breeding game** set in a Japanese zen pond.
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

- **🪙 Coins** trickle in every second from the koi in your pond. Rarer, finer
  koi earn more.
- **🛒 Shop** — buy *Common* or *Wild* koi, **enlarge the pond**, drop in
  **Fish Food** (double income for a while), or **Fertilizer** (instantly ready
  every koi to breed).
- **🐟 Tap a koi** to inspect its genes, value and income. Tap a second koi to
  **pair** them.
- **🧬 Breed** the pair: offspring inherit a blend of both parents' genes, with
  the occasional surprise **mutation**. Some pairings unlock brand-new traits.
- **📖 Koi-dex** — particular trait combinations are recognised as real koi
  varieties (Kohaku, Tancho, Showa, Ogon, Asagi, Kumonryu and more). Discover
  them all.
- **♻️ Pond full?** Release a koi back to the wild for coins to make room for
  your finest fish.
- **🌊 Camera** — drag to look around, scroll to zoom, tap the water for ripples.

Progress saves automatically to your browser, and your koi keep earning (a
little) while you're away.

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
  main.js             # bootstrap, input, game loop, actions, autosave
  game/
    genetics.js       # genome, inheritance, mutation, subspecies, scoring
    state.js          # pond, economy, actions, save/load
  scene/
    pondScene.js      # renderer, camera, lights, fish movement & picking
    origamiFish.js    # procedural faceted origami koi + swim animation
    water.js          # stylised translucent water shader
    ripples.js        # tap ripples & droplet particles
    garden.js         # raked sand, rocks, lily pads, lotus, reeds
  ui/
    ui.js             # HUD, shop, breeding, Koi-dex, inspect card
    toast.js          # transient notifications
test/                 # Node tests (no browser needed)
```

---

## ✅ Tests

The game logic (genetics + economy) and the 3D builders are covered by
dependency-free Node tests:

```bash
node test/genetics.test.js     # genome / inheritance / subspecies / scoring
node test/state.test.js        # economy / breeding / save-load
node test/visual.smoke.mjs     # builds fish/water/ripples/garden vs real Three.js
```

> The visual smoke test resolves `three` via a tiny `node_modules/three` shim
> that re-exports the vendored build; that folder is git-ignored.

Enjoy your pond. 🌿
