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
var __toCommonJS = (mod2) => __copyProps(__defProp({}, "__esModule", { value: true }), mod2);

// es6/enscribe-html5.js
var enscribe_html5_exports = {};
__export(enscribe_html5_exports, {
  default: () => enscribe_html5_default
});
module.exports = __toCommonJS(enscribe_html5_exports);

// es6/enscribe.js
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
function register(type, mod2) {
  en.mods.set(type, mod2);
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
  const mod2 = en.mods.get(player.type);
  if (!mod2) return;
  const u = new SpeechSynthesisUtterance(content);
  if (mod2.getVolume) u.volume = await mod2.getVolume(player);
  const el = player.element;
  const shouldPause = pause || el.hasAttribute("data-ad-global-pause");
  const duckAttr = el.getAttribute("data-ad-ducking");
  const shouldDuck = !shouldPause && duckAttr != null;
  let prev;
  if (shouldDuck && mod2.getVolume && mod2.setVolume) {
    prev = await mod2.getVolume(player);
    await mod2.setVolume(player, +duckAttr || 0.25);
  }
  player.ADPlaying = true;
  speechSynthesis.speak(u);
  if (shouldPause && mod2.control) mod2.control(player, "pause");
  u.onend = async () => {
    if (shouldPause && mod2.control) mod2.control(player, "play");
    if (shouldDuck && mod2.setVolume) await mod2.setVolume(player, prev);
    setTimeout(() => player.ADPlaying = false, 100);
  };
}
async function ensure(type) {
  if (en.mods.has(type)) return;
  const url = en.urls.get(type) || defaultURLFor(type);
  const mod2 = await import(url);
  register(type, mod2.default || mod2.plugin || mod2);
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
function setupToggleButtons() {
  document.querySelectorAll("[data-AD-button]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const el = e.currentTarget;
      const p = en.players.get(el.dataset.adAssociatedPlayer);
      if (!p) return;
      p.enabled = !p.enabled;
      el.classList.toggle("active");
      el.setAttribute("aria-label", `Turn ${p.enabled ? "off" : "on"} audio descriptions`);
      const mod2 = en.mods.get(p.type);
      if (p.ADSource && mod2?.updateSource) {
        await mod2.updateSource(p, p.enabled ? "AD" : "standard");
      } else if (p.type === "html5" && mod2?.setHTML5TrackMode) {
        mod2.setHTML5TrackMode(p);
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
    const mod2 = en.mods.get(p.type);
    if (mod2?.setup) await mod2.setup(p, { speak, getCueData });
  }
  setupToggleButtons();
}
init();

// es6/enscribe-html5.js
var mod = {
  getVolume: (p) => Promise.resolve(p.element.volume),
  setVolume: (p, v) => {
    p.element.volume = v;
  },
  control: (p, action) => p.element[action](),
  setHTML5TrackMode: (p) => {
    if (p.ADTrack) p.ADTrack.mode = p.enabled ? "showing" : "disabled";
  },
  async updateSource(p, which) {
    const src = which === "AD" ? p.ADSource : p.standardSource;
    const v = p.element, s = v.querySelector("source");
    const time = v.currentTime, paused = v.paused;
    s.src = src;
    v.load();
    v.currentTime = time;
    if (!paused) v.play();
  },
  async setup(p) {
    for (const t of p.element.textTracks) {
      if (t.kind === "descriptions") {
        p.ADTrack = t;
        break;
      }
    }
    if (!p.element.dataset.adVideoSource && p.ADTrack) {
      p.ADTrack.addEventListener("cuechange", (e) => {
        if (p.ADPlaying) return;
        const cue = e.currentTarget.activeCues[0];
        if (cue) speak(...Object.values(getCueData(cue)), p);
      });
    }
    p.element.textTracks?.addEventListener?.("change", () => mod.setHTML5TrackMode(p));
  }
};
register("html5", mod);
var enscribe_html5_default = mod;
//# sourceMappingURL=enscribeHTML5.cjs.js.map
