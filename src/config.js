// =============================================================================
// Plenty Fish in the Sea — global tunables
// All gameplay balance lives here so it is easy to find and adjust.
// =============================================================================

export const CONFIG = {
  // --- Economy -------------------------------------------------------------
  startingCoins: 50,
  startingCapacity: 6,
  // Coins generated per second is sum over fish of (incomeBase * qualityFactor).
  incomeBase: 0.06,
  // Cost to buy a fresh pond-grade (common) fish. Scales with how many you own.
  basicFishBaseCost: 25,
  basicFishCostGrowth: 1.18,
  // Capacity upgrades.
  capacityStep: 4,
  capacityBaseCost: 80,
  capacityCostGrowth: 1.55,
  maxCapacity: 120,
  // A small fee per breeding (spawning food), plus a cooldown.
  breedCost: 12,
  breedCooldownMs: 14000,
  // Fertilizer item removes all breeding cooldowns instantly.
  fertilizerCost: 40,
  // Feeding the pond temporarily boosts income.
  feedCost: 30,
  feedBoostMult: 2.0,
  feedBoostMs: 30000,
  // Offline income is granted on load, capped so it stays a treat, not a job.
  offlineCapMs: 2 * 60 * 60 * 1000,
  offlineRate: 0.5,

  // --- Genetics ------------------------------------------------------------
  // Per-gene chance to mutate during breeding, and the noise applied when it does.
  mutationRate: 0.28,
  mutationSigma: 0.09,
  // Rare large "sport" mutation for novelty.
  bigMutationRate: 0.04,
  bigMutationSigma: 0.32,
  // Offspring per successful breed (inclusive range).
  minOffspring: 1,
  maxOffspring: 3,
  // Size gene maps to this visual/scale range.
  sizeMin: 0.62,
  sizeMax: 1.85,

  // --- Pond / world --------------------------------------------------------
  pondRadius: 18,
  swimDepth: -0.35, // how far below the water surface fish float
  maxRenderedFish: 120,

  // --- Persistence ---------------------------------------------------------
  saveKey: 'pfits.save.v1',
  autosaveMs: 4000,
};

// Quality weighting — how each phenotype trait contributes to a fish's
// quality score (0..1-ish before subspecies bonus). Tunable feel.
export const QUALITY_WEIGHTS = {
  size: 0.26,
  luster: 0.24,
  patternRarity: 0.18,
  finRarity: 0.12,
  vigor: 0.10,
  fertility: 0.10,
};
