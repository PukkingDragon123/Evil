/* leaderboard.js — local high-score board persisted in localStorage.
   Stores { name, score, mode, difficulty, date }. Exposes RB.leaderboard. */
(function (global) {
  const RB = (global.RB = global.RB || {});
  const KEY = 'rapbattle.board.v1';
  const TAGKEY = 'rapbattle.tag';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }
  function persist(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* private mode */ }
  }

  // Add an entry, keep the board sorted + capped, return the 1-based rank.
  function add(entry) {
    const e = {
      name: (entry.name || 'MC').slice(0, 14),
      score: Math.round(entry.score || 0),
      mode: entry.mode || 'solo',
      difficulty: entry.difficulty || 'normal',
      date: Date.now(),
    };
    const list = load();
    list.push(e);
    list.sort((a, b) => b.score - a.score || a.date - b.date);
    const top = list.slice(0, 50);
    persist(top);
    return top.indexOf(e) + 1;
  }

  const top = (n) => load().slice(0, n || 10);
  const clear = () => persist([]);
  const lastTag = () => { try { return localStorage.getItem(TAGKEY) || ''; } catch (e) { return ''; } };
  const setTag = (t) => { try { localStorage.setItem(TAGKEY, t || ''); } catch (e) {} };
  const available = () => { try { localStorage.setItem('rb.t', '1'); localStorage.removeItem('rb.t'); return true; } catch (e) { return false; } };

  RB.leaderboard = { load, add, top, clear, lastTag, setTag, available };
})(window);
