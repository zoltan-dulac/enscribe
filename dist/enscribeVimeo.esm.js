// es6/enscribe.js
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
var baseURL = new URL(".", isES6Module ? import.meta.url : location.origin + location.pathname.replace(/\/[^/]*$/, "/") + enableRootDir);
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

// es6/enscribe-vimeo.js
var vimeoReady;
function loadVimeoAPI() {
  if (vimeoReady)
    return vimeoReady;
  vimeoReady = new Promise((res) => {
    const s = document.createElement("script");
    s.onload = res;
    s.src = "https://player.vimeo.com/api/player.js";
    document.head.appendChild(s);
  });
  return vimeoReady;
}
var mod = {
  getVolume: (p) => p.vimeo.getVolume(),
  setVolume: (p, v) => p.vimeo.setVolume(v),
  control: (p, action) => p.vimeo[action](),
  async updateSource(p, which) {
    const src = which === "AD" ? p.ADSource : p.standardSource;
    const cur = await p.vimeo.getCurrentTime();
    const paused = await p.vimeo.getPaused();
    await p.vimeo.loadVideo(src);
    await p.vimeo.setCurrentTime(cur);
    if (!paused)
      p.vimeo.play();
  },
  async setup(p) {
    await loadVimeoAPI();
    if (!p.element.dataset.adVideoSource) {
      const v = document.createElement("video");
      const t = Object.assign(document.createElement("track"), {
        kind: "descriptions",
        label: "Audio Descriptions",
        srclang: "en",
        src: p.element.dataset.adPlayerVttPath
      });
      v.appendChild(t);
      const tt = v.textTracks[0];
      tt.mode = "hidden";
      t.addEventListener("load", () => {
        console.log("loaded");
        p.ADTrack = tt;
        if (p.ADTrack) {
          for (const cue of p.ADTrack.cues) {
            const { content, pause } = getCueData(cue);
            p.vimeo.addCuePoint(cue.startTime, { content, pause });
          }
          p.vimeo.on("cuepoint", (e) => p.enabled && speak(e.data.content, e.data.pause, p));
        }
      }, { once: true });
      document.body.appendChild(v);
    }
    p.vimeo = new Vimeo.Player(p.element);
  }
};
register("vimeo", mod);
var enscribe_vimeo_default = mod;
export {
  enscribe_vimeo_default as default
};
//# sourceMappingURL=enscribeVimeo.esm.js.map
