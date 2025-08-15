// enscribe-vimeo.js
import { register, getCueData, speak, createExternalTracksFor, loadScript } from './enscribe.js';

const mod = {
  getVolume: (p) => p.vimeo.getVolume(),
  setVolume: (p, v) => p.vimeo.setVolume(v),
  control: (p, action) => p.vimeo[action](),

  updateSource: async (p, which) => {
    const src = which === 'AD' ? p.ADSource : p.standardSource;
    const cur = await p.vimeo.getCurrentTime();
    const paused = await p.vimeo.getPaused();
    await p.vimeo.loadVideo(src);
    await p.vimeo.setCurrentTime(cur);
    if (!paused) p.vimeo.play();
  },

  async setup(p) {
    // Build hidden VTT proxy only when NOT using an alternate AD video
    await createExternalTracksFor(p);

    // Load classic Vimeo API script (UMD/global), not an ES module
    await loadScript('https://player.vimeo.com/api/player.js');
    p.vimeo = new Vimeo.Player(p.element);

    if (p.ADTrack) {
      for (const cue of p.ADTrack.cues) {
        const { content, pause } = getCueData(cue);
        p.vimeo.addCuePoint(cue.startTime, { content, pause });
      }
      p.vimeo.on('cuepoint', (e) => {
        if (p.enabled) speak(e.data.content, e.data.pause, p);
      });
    }
  }
};

register('vimeo', mod);
export default mod;
