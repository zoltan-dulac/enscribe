// enscribe-youtube.js
import { register, getCueData, speak, createExternalTracksFor } from './enscribe.js';

let ytReady;
function loadYT() {
  if (ytReady) return ytReady;
  ytReady = new Promise((res) => {
    window.onYouTubeIframeAPIReady = res;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return ytReady;
}

const mod = {
  getVolume: (p) => Promise.resolve(p.youtube.getVolume() / 100),
  setVolume: (p, v) => p.youtube.setVolume(Math.round(v * 100)),
  control: (p, action) => p.youtube[action + 'Video'](),

  updateSource: async (p, which) => {
    const id = which === 'AD' ? p.ADSource : p.standardSource;
    const cur = p.youtube.getCurrentTime();
    const paused = p.youtube.getPlayerState() === 2;
    p.youtube.loadVideoById(id, cur);
    const poll = setInterval(() => {
      if (p.youtube.getPlayerState() === -1) {
        paused ? p.youtube.pauseVideo() : p.youtube.playVideo();
        clearInterval(poll);
      }
    }, 100);
  },

  async setup(p) {
    // Use shared helper for hidden VTT proxy
    await createExternalTracksFor(p);

    await loadYT();
    p.youtube = new YT.Player(p.element.id, {
      events: {
        onStateChange: (e) => {
          if (e.data !== YT.PlayerState.UNSTARTED && !p._pollStarted && !p.element.dataset.adVideoSource) {
            p._pollStarted = true;

            const tick = () => {
              if (!p.enabled || p.ADPlaying || !p.youtube?.getCurrentTime) return;
              const now = p.youtube.getCurrentTime();
              if (p._lastTime != null && now < p._lastTime - 0.2) p._recentCue = undefined; // rewound
              p._lastTime = now;

              if (!p.ADTrack) return;
              for (const c of p.ADTrack.cues) {
                if (p._recentCue === c.startTime) continue; // de-dupe most recent
                if (Math.abs(now - c.startTime) <= 0.1) {
                  p._recentCue = c.startTime;
                  return speak(...Object.values(getCueData(c)), p);
                }
              }
            };

            p._ytInterval = setInterval(tick, 100);
          }
        }
      }
    });
  }
};

register('youtube', mod);
export default mod;
