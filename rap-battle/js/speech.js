/* speech.js — thin wrapper over the Web Speech API (SpeechRecognition).
   Streams a live transcript while the player rhymes. Exposes RB.speech. */
(function (global) {
  const RB = (global.RB = global.RB || {});

  const SR = global.SpeechRecognition || global.webkitSpeechRecognition;
  const supported = !!SR;

  let rec = null;
  let active = false;
  let finalText = '';
  let interim = '';
  let onUpdate = null;

  function start(update) {
    if (!supported) return false;
    onUpdate = update;
    finalText = '';
    interim = '';
    active = true;

    rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + ' ';
        else interim += r[0].transcript;
      }
      if (onUpdate) onUpdate(fullText(), finalText.trim());
    };

    rec.onerror = (e) => {
      // 'no-speech' / 'aborted' are routine — just let onend restart us.
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        active = false;
      }
    };

    rec.onend = () => {
      // Chrome ends the session periodically; restart while we're live.
      if (active) {
        try { rec.start(); } catch (_) { /* already starting */ }
      }
    };

    try { rec.start(); } catch (_) { /* ignore double-start */ }
    return true;
  }

  function stop() {
    active = false;
    if (rec) {
      try { rec.stop(); } catch (_) {}
    }
    return finalText.trim();
  }

  function fullText() {
    return (finalText + ' ' + interim).trim();
  }

  RB.speech = {
    supported,
    start,
    stop,
    fullText,
    get isActive() { return active; },
  };
})(window);
