/* enscribe-vimeo.js — Vimeo platform module */
(function(w){
  const en = w.enscribe;

  const loadAPI = ()=> en._vimeoReady || (en._vimeoReady = en.loadScript('https://player.vimeo.com/api/player.js'));

  const mod = {
    getVolume: p => p.vimeo.getVolume(),                 // returns Promise
    setVolume: (p,v)=> p.vimeo.setVolume(v),
    control: (p,action)=> p.vimeo[action](),

    updateSource: async (p, which)=>{
      const src = which==='AD' ? p.ADSource : p.standardSource;
      const cur = await p.vimeo.getCurrentTime();
      const paused = await p.vimeo.getPaused();
      await p.vimeo.loadVideo(src);
      await p.vimeo.setCurrentTime(cur);
      if (!paused) p.vimeo.play();
    },

    async setup(p, base){
      await en.createExternalTracksFor(p);           // parse VTT in hidden <video>
      await loadAPI();
      p.vimeo = new Vimeo.Player(p.element);

      if (p.ADTrack){
        for (const cue of p.ADTrack.cues){
          const {content, pause}=base.getCueData(cue);
          p.vimeo.addCuePoint(cue.startTime, {content, pause});
        }
        p.vimeo.on('cuepoint', e=>{
          if (p.enabled) base.speak(e.data.content, e.data.pause, p);
        });
      }
    }
  };

  en.register('vimeo', mod);
})(window);
