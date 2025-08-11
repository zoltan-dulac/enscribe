var enscribe = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // es6/enscribe.js
  var enscribe_exports = {};
  __export(enscribe_exports, {
    createPlayerMappings: () => createPlayerMappings,
    getCueData: () => getCueData,
    htmlToText: () => htmlToText,
    init: () => init,
    loadScript: () => loadScript,
    register: () => register,
    setEnabled: () => setEnabled,
    setPluginURL: () => setPluginURL,
    setupToggleButtons: () => setupToggleButtons,
    speak: () => speak
  });
  var import_meta = {};
  var en = {
    players: /* @__PURE__ */ new Map(),
    mods: /* @__PURE__ */ new Map(),
    // type -> module (html5|vimeo|youtube|…)
    urls: /* @__PURE__ */ new Map(),
    // type -> absolute URL to plugin file
    ready: false
  };
  var isES6Module = !document.currentScript;
  console.log("es6mod", isES6Module);
  var baseURL = new URL(".", isES6Module ? import_meta.url : location.origin + location.pathname.replace(/\/[^/]*$/, "/") + enableRootDir);
  console.log("url", baseURL);
  var defaultURLFor = (type) => new URL(`./enscribe-${type}.js`, baseURL).href;
  function setPluginURL(type, url) {
    en.urls.set(type, new URL(url, baseURL).href);
  }
  function register(type, mod) {
    en.mods.set(type, mod);
  }
  function htmlToText(html) {
    const d = document.createElement("div");
    d.appendChild(html.cloneNode(true));
    return d.textContent || "";
  }
  function getCueData(cue) {
    const h = cue.getCueAsHTML();
    return { content: htmlToText(h), pause: !!h.querySelector("span.pause") };
  }
  async function speak(content, pause, player) {
    const mod = en.mods.get(player.type);
    if (!mod) return;
    const u = new SpeechSynthesisUtterance(content);
    if (mod.getVolume) u.volume = await mod.getVolume(player);
    const el = player.element;
    const shouldPause = pause || el.hasAttribute("data-ad-global-pause");
    const duckAttr = el.getAttribute("data-ad-ducking");
    const shouldDuck = !shouldPause && duckAttr != null;
    let prev;
    if (shouldDuck && mod.getVolume && mod.setVolume) {
      prev = await mod.getVolume(player);
      await mod.setVolume(player, +duckAttr || 0.25);
    }
    player.ADPlaying = true;
    speechSynthesis.speak(u);
    if (shouldPause && mod.control) mod.control(player, "pause");
    u.onend = async () => {
      if (shouldPause && mod.control) mod.control(player, "play");
      if (shouldDuck && mod.setVolume) await mod.setVolume(player, prev);
      setTimeout(() => player.ADPlaying = false, 100);
    };
  }
  function loadScript(src) {
    return new Promise((r) => {
      const s = document.createElement("script");
      s.onload = r;
      s.src = src;
      document.head.appendChild(s);
    });
  }
  async function ensure(type) {
    if (en.mods.has(type)) return;
    const url = en.urls.get(type) || defaultURLFor(type);
    const mod = await import(url);
    register(type, mod.default || mod.plugin || mod);
  }
  function createPlayerMappings() {
    document.querySelectorAll("[data-AD-player]").forEach((el) => {
      const type = el.dataset.adPlayerType;
      let standardSource = el.querySelector("source")?.src || el.src;
      if (type === "youtube") {
        const m = /embed\/([^?]+)/.exec(el.src);
        standardSource = m ? m[1] : "";
      }
      en.players.set(el.id, {
        element: el,
        type,
        standardSource,
        ADSource: el.dataset.adVideoSource,
        enabled: false,
        ADPlaying: false
      });
    });
  }
  function setEnabled(playerId, enabled) {
    const p = en.players.get(playerId);
    if (!p) return;
    p.enabled = enabled;
    const mod = en.mods.get(p.type);
    if (p.type === "html5" && mod?.setHTML5TrackMode) mod.setHTML5TrackMode(p);
  }
  function setupToggleButtons() {
    document.querySelectorAll("[data-AD-button]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const el = e.currentTarget;
        const p = en.players.get(el.dataset.adAssociatedPlayer);
        if (!p) return;
        p.enabled = !p.enabled;
        el.classList.toggle("active");
        el.setAttribute("aria-label", `Turn ${p.enabled ? "off" : "on"} audio descriptions`);
        const mod = en.mods.get(p.type);
        if (p.ADSource && mod?.updateSource) {
          await mod.updateSource(p, p.enabled ? "AD" : "standard");
        } else if (p.type === "html5" && mod?.setHTML5TrackMode) {
          mod.setHTML5TrackMode(p);
        }
      });
    });
  }
  async function init() {
    console.log("init");
    if (en.ready) return;
    en.ready = true;
    createPlayerMappings();
    for (const p of en.players.values()) {
      await ensure(p.type);
      const mod = en.mods.get(p.type);
      if (mod?.setup) await mod.setup(p, { speak, getCueData });
    }
    setupToggleButtons();
  }
  init();
  return __toCommonJS(enscribe_exports);
})();
//# sourceMappingURL=enscribe.iife.js.map
