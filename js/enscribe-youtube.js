/* enscribe-youtube.js — YouTube platform module */
(function(w){
  const en = w.enscribe;

  const loadAPI = ()=> en._ytReady || (en._ytReady = new Promise(res=>{
    w.onYouTubeIframeAPIReady=res;
    en.loadScript('https://www.youtube.com/iframe_api');
  }));

  const mod = {
    getVolume: p => Promise.resolve(p.youtube.getVolume()/100),
    setVolume: (p,v)=> p.youtube.setVolume(Math.round(v*100)),
    control: (p,action)=> p.youtube[action+'Video'](),

    updateSource: async (p, which)=>{
      const id = which==='AD' ? p.ADSource : p.standardSource;
      const cur = p.youtube.getCurrentTime();
      const paused = p.youtube.getPlayerState()===2;
      p.youtube.loadVideoById(id, cur);
      const poll=setInterval(()=>{
        if (p.youtube.getPlayerState()===-1){
          paused ? p.youtube.pauseVideo() : p.youtube.playVideo();
          clearInterval(poll);
        }
      },100);
    },

    async setup(p, base){
      await en.createExternalTracksFor(p);            // hidden VTT track
      await loadAPI();
      p.youtube = new YT.Player(p.element.id, {
        events:{
          onStateChange: e=>{
            if (e.data!==YT.PlayerState.UNSTARTED && !p._pollStarted && !p.element.dataset.adVideoSource){
              p._pollStarted=true;
              // simple poller with de-dupe on recent cue
              const tick=()=>{
                if (!p.enabled || p.ADPlaying || !p.youtube?.getCurrentTime) return;
                const now=p.youtube.getCurrentTime();
                if (p._lastTime!=null && now<p._lastTime-0.2) p._recentCue=undefined;
                p._lastTime=now;
                for (const c of p.ADTrack.cues){
                  if (p._recentCue===c.startTime) continue;
                  if (Math.abs(now-c.startTime)<=0.1){
                    p._recentCue=c.startTime;
                    return base.speak(...Object.values(base.getCueData(c)), p);
                  }
                }
              };
              p._ytInterval=setInterval(tick,100);
            }
          }
        }
      });
    }
  };

  en.register('youtube', mod);
})(window);
