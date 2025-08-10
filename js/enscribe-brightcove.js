/* enscribe-brightcove.js — Brightcove example plugin */
(function (w) {
    const en = w.enscribe;
  
    const mod = {
      // OPTIONAL—only if you support ducking
      getVolume: (p) => Promise.resolve(p.bcPlayer.muted() ? 0 : p.bcPlayer.volume()),
      setVolume: (p, v) => { p.bcPlayer.volume(v); },
  
      // REQUIRED if you want pause/resume during TTS
      control: (p, action) => p.bcPlayer[action](), // 'play' / 'pause'
  
      // OPTIONAL—switch to the AD or standard video source preserving time
      updateSource: async (p, which) => {
        const cur = p.bcPlayer.currentTime();
        const paused = p.bcPlayer.paused();
        const src = which === 'AD' ? p.ADSource : p.standardSource;
        p.bcPlayer.src({ src, type: 'video/mp4' }); // adjust type for your sources
        p.bcPlayer.one('loadedmetadata', () => {
          p.bcPlayer.currentTime(cur);
          if (!paused) p.bcPlayer.play();
        });
      },
  
      // REQUIRED—hook player and wire VTT cues to speak()
      async setup(p, base) {
        // Example: suppose page has Brightcove Player created and accessible via videojs
        // You can also create it here if needed.
        p.bcPlayer = videojs(p.element); // or however you get the instance
  
        await en.createExternalTracksFor(p); // parse WebVTT in hidden <video>
  
        if (p.ADTrack) {
          // Brightcove/video.js has a cuepoint plugin; below is a simple timeupdate poller:
          const tick = () => {
            if (!p.enabled || p.ADPlaying) return;
            const now = p.bcPlayer.currentTime();
            for (const c of p.ADTrack.cues) {
              if (Math.abs(now - c.startTime) <= 0.1) {
                return base.speak(...Object.values(base.getCueData(c)), p);
              }
            }
          };
          p._bcInterval = setInterval(tick, 100);
        }
      }
    };
  
    en.register('brightcove', mod);
  })(window);
  