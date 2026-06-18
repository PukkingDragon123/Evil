// =============================================================================
// Plenty Fish in the Sea — global tunables.
// Cozy, slow, "koi are precious": passive income is gentle, koi come from the
// timed Market or from breeding, and buyers pay premiums for koi you raise.
// =============================================================================

export const CONFIG = {
  // --- Economy (gentle & relaxing) -----------------------------------------
  startingCoins: 250,
  startingCapacity: 6,
  incomeBase: 0.06,             // a kinder passive trickle

  // Pond capacity upgrades.
  capacityStep: 3,
  capacityBaseCost: 100,
  capacityCostGrowth: 1.5,
  maxCapacity: 90,

  // Breeding (easy, unhurried).
  breedCost: 12,
  breedCooldownMs: 16000,
  breedPreviewTrials: 260,

  // Offline income is granted on load, capped so it stays a treat.
  offlineCapMs: 2 * 60 * 60 * 1000,
  offlineRate: 0.5,

  // --- Koi Market (3 random koi, refreshing on a timer) --------------------
  market: {
    size: 3,
    refreshMs: 75000,
    priceMult: 2.0,             // koi are special, but not punishing
  },

  // --- Buyers / offers (no rush) -------------------------------------------
  offers: {
    max: 3,
    intervalMs: 80000,
    expireMs: 220000,
    premiumMin: 1.8,
    premiumMax: 3.2,
  },

  // --- Weather (slow, calm changes) ----------------------------------------
  weather: {
    minMs: 60000,
    maxMs: 130000,
  },

  // --- Genetics ------------------------------------------------------------
  mutationRate: 0.28,
  mutationSigma: 0.09,
  bigMutationRate: 0.04,
  bigMutationSigma: 0.32,
  minOffspring: 1,
  maxOffspring: 3,
  sizeMin: 0.6,
  sizeMax: 1.85,

  // --- Pond / world --------------------------------------------------------
  pondRadius: 18,
  swimDepth: -0.35,
  maxRenderedFish: 90,
  fishSpeed: 0.55,              // calm, gliding koi
  koiOutline: true,            // clean stylised ink outline on the koi

  // --- Persistence ---------------------------------------------------------
  saveKey: 'pfits.save.v2',
  autosaveMs: 4000,
};

// Quality weighting — how each phenotype trait contributes to quality.
export const QUALITY_WEIGHTS = {
  size: 0.26,
  luster: 0.24,
  patternRarity: 0.18,
  finRarity: 0.12,
  vigor: 0.10,
  fertility: 0.10,
};
