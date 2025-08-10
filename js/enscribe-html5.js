
/* enscribe-html5.js — HTML5 platform module */
(function(w){
  const en = w.enscribe;

  const mod = {
    getVolume: p => Promise.resolve(p.element.volume),
    setVolume: (p,v)=>{ p.element.volume=v; },
    control: (p,action)=> p.element[action](),
    setHTML5TrackMode: (p)=>{ if(p.ADTrack) p.ADTrack.mode = p.enabled?'showing':'disabled'; },

    updateSource: async (p, which)=>{
      const src = which==='AD' ? p.ADSource : p.standardSource;
      const v = p.element, s=v.querySelector('source');
      const time=v.currentTime, paused=v.paused;
      s.src=src; v.load(); v.currentTime=time; if(!paused) v.play();
    },

    async setup(p, base){
      // find descriptions track on the main element (no proxy if alt video is used)
      for (const t of p.element.textTracks){
        if (t.kind==='descriptions'){
          p.ADTrack=t; break;
        }
      }
      if (!p.element.dataset.adVideoSource && p.ADTrack){
        p.ADTrack.addEventListener('cuechange', e=>{
          if (p.ADPlaying) return;
          const cue=e.currentTarget.activeCues[0];
          if (cue) base.speak(...Object.values(base.getCueData(cue)), p);
        });
      }
      // keep captions state consistent
      p.element.textTracks?.addEventListener?.('change', ()=>mod.setHTML5TrackMode(p));
    }
  };

  en.register('html5', mod);
})(window);
