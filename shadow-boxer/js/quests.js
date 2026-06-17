/* quests.js — quest progress + payouts. The fight/training engine reports
   events (punch, combo, block, slip, win, ko, damage, train); we advance the
   matching quests and let the UI claim finished ones for SPIN. SB.quests. */
(function (global) {
  const SB = (global.SB = global.SB || {});

  // One fight's events arrive as a tally object; fold it into quest progress.
  // 'combo' is a high-water mark (best combo), everything else accumulates.
  function report(tally) {
    const t = tally || {};
    for (const q of SB.data.QUESTS) {
      const rec = SB.store.questRec(q.id);
      if (rec.claimed) continue;
      const v = t[q.metric] || 0;
      if (!v) continue;
      if (q.metric === 'combo') rec.progress = Math.max(rec.progress, v);
      else rec.progress = Math.min(q.goal, rec.progress + v);
    }
    SB.store.save();
  }

  function list() {
    return SB.data.QUESTS.map((q) => {
      const rec = SB.store.questRec(q.id);
      const progress = Math.min(rec.progress, q.goal);
      return {
        ...q,
        progress,
        pct: Math.round((progress / q.goal) * 100),
        done: progress >= q.goal,
        claimed: rec.claimed,
        claimable: progress >= q.goal && !rec.claimed,
      };
    });
  }

  // Claim a finished quest -> returns spin awarded (0 if not claimable).
  function claim(id) {
    const q = SB.data.QUESTS.find((x) => x.id === id);
    if (!q) return 0;
    const rec = SB.store.questRec(id);
    if (rec.claimed || rec.progress < q.goal) return 0;
    rec.claimed = true;
    SB.store.addSpin(q.reward);
    SB.store.save();
    return q.reward;
  }

  const claimableCount = () => list().filter((q) => q.claimable).length;

  SB.quests = { report, list, claim, claimableCount };
})(window);
