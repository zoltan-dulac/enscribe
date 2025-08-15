// voice-manager.js
// Lightweight voice selection + rate normalization for Web Speech API.
// No deps. ES module. Works with Chrome/Edge/Firefox/Safari (where supported).

const LS_KEY = 'enscribe.voice.pref';
const LS_RATE = 'enscribe.voice.rateMultipliers'; // map of voiceURI->multiplier

class VoiceManager {
  constructor() {
    this._ready = null;
    this._voices = [];
    this._config = {
      localeHints: [navigator.language, (navigator.language || 'en-US').split('-')[0], 'en-US'],
      preferLocal: false,
      allowCloud: true,
      useCache: true
    };
    this._preferred = null;    // {voiceURI,name,lang} from user or cache
    this._rateMap = {};        // voiceURI -> multiplier
    this._loadCache();
  }

  init(cfg = {}) {
    Object.assign(this._config, cfg);
    // Kick off voice loading once
    if (!this._ready) this._ready = this._loadVoices();
    return this._ready;
  }

  async ready() {
    if (!this._ready) this._ready = this._loadVoices();
    await this._ready;
    return this._voices;
  }

  async _loadVoices() {
    // Normalize “voiceschanged” behavior across engines
    const synth = window.speechSynthesis;
    const get = () => synth.getVoices() || [];
    let list = get();

    if (list.length) {
      this._voices = list;
      return;
    }

    // Wait for voiceschanged or fallback timeout
    await new Promise(resolve => {
      const timer = setTimeout(() => {
        synth.removeEventListener?.('voiceschanged', onEvt);
        resolve();
      }, 1200); // small timeout; we’ll re-run if event fires later

      const onEvt = () => {
        clearTimeout(timer);
        synth.removeEventListener?.('voiceschanged', onEvt);
        resolve();
      };

      synth.addEventListener?.('voiceschanged', onEvt);
      // Also poke getVoices again after microtask
      queueMicrotask(() => void get());
    });

    // After event/timeout, read whatever is available
    list = get();
    // Some engines fire voiceschanged multiple times; keep the largest set
    if (list.length > this._voices.length) this._voices = list;
  }

  // Public API ---------------------------------------------------------------

  setPreferredVoice(voiceIdOrName) {
    const v = this._voices.find(v =>
      v.voiceURI === voiceIdOrName || v.name === voiceIdOrName
    );
    if (v) {
      this._preferred = { voiceURI: v.voiceURI, name: v.name, lang: v.lang };
      this._saveCache();
    }
    return v || null;
  }

  async topCandidates({ limit = 6 } = {}) {
    await this.ready();
    const scored = this._scoreAll();
    return scored.slice(0, limit).map(({ voice, score }) => ({ voice, score }));
  }

  // Applies best voice and a normalized rate to an utterance
  applyTo(utterance, { targetRate = 1.0 } = {}) {
    const chosen = this._choose();
    if (chosen) utterance.voice = chosen;

    // Rate normalization: multiply caller’s intended rate by our per-voice factor
    const vm = this._rateMap[chosen?.voiceURI] ?? 1.0;
    utterance.rate = Math.max(0.1, Math.min(10, targetRate * vm));
    return chosen;
  }

  // One-time timing calibration: speak a fixed sentence and measure duration.
  // Stores a multiplier per voice to hit targetSeconds at rate=1.0
  async calibrate({ sampleText = 'This is a timing check.', targetSeconds = 2.0 } = {}) {
    await this.ready();
    const voice = this._choose();
    if (!voice) return null;

    const u = new SpeechSynthesisUtterance(sampleText);
    u.voice = voice;
    u.rate = 1.0;
    const start = await new Promise(resolve => {
      u.onstart = () => resolve(performance.now());
      speechSynthesis.speak(u);
    });
    const end = await new Promise(resolve => {
      u.onend = () => resolve(performance.now());
    });

    const dur = Math.max(1, (end - start) / 1000);
    const mult = targetSeconds / dur; // if speech was fast (<target), mult > 1
    this._rateMap[voice.voiceURI] = mult;
    this._saveCache();
    return { voice, seconds: dur, multiplier: mult };
  }

  // Internal -----------------------------------------------------------------

  _choose() {
    // 1) User/cached preferred, if still present
    const cached = this._preferred && this._voices.find(v => v.voiceURI === this._preferred.voiceURI);
    if (cached) return cached;

    // 2) Best scored candidate
    const list = this._scoreAll();
    const top = list[0]?.voice;
    if (top && this._config.useCache) {
      this._preferred = { voiceURI: top.voiceURI, name: top.name, lang: top.lang };
      this._saveCache();
    }
    return top || null;
  }

  _scoreAll() {
    const hints = this._config.localeHints.filter(Boolean);
    const wantLangs = this._expandLangs(hints);
    const allowCloud = this._config.allowCloud;
    const preferLocal = this._config.preferLocal;

    const withScores = this._voices.map(voice => {
      let s = 0;

      // Language/region matching
      const vlang = (voice.lang || '').toLowerCase();
      const exact = wantLangs.exact.has(vlang);
      const base = wantLangs.base.has(vlang.split('-')[0]);
      if (exact) s += 3;
      else if (base) s += 2;

      // Local vs cloud (remote)
      const isLocal = !!voice.localService;
      if (preferLocal && isLocal) s += 1;
      if (!preferLocal && !isLocal && allowCloud) s += 1;

      // Quality hints in name
      const name = (voice.name || '') + ' ' + (voice.voiceURI || '');
      if (/\b(Neural|Natural|Premium|Online)\b/i.test(name)) s += 2;

      // Known vendor hints
      if (/\b(Google|Microsoft|Apple)\b/i.test(name)) s += 0.5;

      // Default flag
      if (voice.default) s += 0.5;

      return { voice, score: s };
    });

    // Stable sort: higher score, then exact locale order of hints, then name
    withScores.sort((a, b) => b.score - a.score || a.voice.name.localeCompare(b.voice.name));
    return withScores;
  }

  _expandLangs(hints) {
    // Normalize hints into sets for quick checks
    const exact = new Set();
    const base = new Set();
    for (const h of hints) {
      if (!h) continue;
      const low = h.toLowerCase();
      exact.add(low);
      base.add(low.split('-')[0]);
    }
    return { exact, base };
  }

  _loadCache() {
    try {
      const pref = localStorage.getItem(LS_KEY);
      if (pref) this._preferred = JSON.parse(pref);
      const r = localStorage.getItem(LS_RATE);
      if (r) this._rateMap = JSON.parse(r);
    } catch {}
  }

  _saveCache() {
    if (!this._config.useCache) return;
    try {
      if (this._preferred) localStorage.setItem(LS_KEY, JSON.stringify(this._preferred));
      localStorage.setItem(LS_RATE, JSON.stringify(this._rateMap));
    } catch {}
  }
}

export const voiceManager = new VoiceManager();
