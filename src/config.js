// =============================================================================
// Plenty Fish in the Sea — global tunables.
// Cozy, slow, "koi are precious": passive income is gentle, koi come from the
// timed Market or from breeding, and buyers pay premiums for koi you raise.
// =============================================================================

export const CONFIG = {
  // --- Economy -------------------------------------------------------------
  startingCoins: 160,
  startingCapacity: 6,
  incomeBase: 0.035,            // gentle passive trickle; offers are the real money

  // Pond capacity upgrades.
  capacityStep: 3,
  capacityBaseCost: 140,
  capacityCostGrowth: 1.6,
  maxCapacity: 90,

  // Breeding (cozy, deliberate).
  breedCost: 18,
  breedCooldownMs: 22000,
  breedPreviewTrials: 260,      // Monte-Carlo samples for the breeding-cave odds

  // Offline income is granted on load, capped so it stays a treat.
  offlineCapMs: 2 * 60 * 60 * 1000,
  offlineRate: 0.5,

  // --- Koi Market (3 random koi, refreshing on a timer) --------------------
  market: {
    size: 3,
    refreshMs: 60000,
    priceMult: 2.6,             // koi are dear — buying is a commitment
  },

  // --- Buyers / offers -----------------------------------------------------
  offers: {
    max: 3,
    intervalMs: 70000,          // a new visitor roughly this often
    expireMs: 165000,
    premiumMin: 1.8,
    premiumMax: 3.2,
  },

  // --- Weather -------------------------------------------------------------
  weather: {
    minMs: 42000,
    maxMs: 95000,
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
  fishSpeed: 0.7,               // global swim-speed scale (cozy = slow)

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
