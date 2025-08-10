/* 
  enscribe.js — base
  Depends on platform modules that call enscribe.register('html5'|'vimeo'|'youtube', module)
*/

(function (w) { // figure out the directory that enscribe.js was loaded from
	const thisScriptSrc = document.currentScript ?. src || (() => {
		const ss = document.getElementsByTagName('script');
		for (let i = ss.length - 1; i >= 0; i--) 
			if (ss[i].src) 
				return ss[i].src;
			
		
		return '';
	})();

	const baseURL = thisScriptSrc ? thisScriptSrc.slice(0, thisScriptSrc.lastIndexOf('/') + 1) : '';

	const en = w.enscribe = {
		players: {},
		mods: {},
		// use absolute URLs based on enscribe.js location
		urls: {
			html5: baseURL + 'enscribe-html5.js',
			vimeo: baseURL + 'enscribe-vimeo.js',
			youtube: baseURL + 'enscribe-youtube.js'
		},
		register(type, mod) {
			this.mods[type] = mod;
		},
		loadScript(src) {
			return new Promise(r => {
				const s = document.createElement('script');
				s.onload = r;
				s.src = src;
				document.head.appendChild(s);
			});
		},
		ensure(type) {
			return this.mods[type] ? Promise.resolve() : this.loadScript(this.urls[type]);
		},

		htmlToText(html) {
			const d = document.createElement('div');
			d.appendChild(html.cloneNode(true));
			return d.textContent || '';
		},
		getCueData(cue) {
			const h = cue.getCueAsHTML();
			return {
				content: en.htmlToText(h),
				pause: !! h.querySelector('span.pause')
			};
		},

		async speak(content, pause, p) {
			const m = this.mods[p.type];
			if (! m) 
				return;
			
			const u = new SpeechSynthesisUtterance(content);
			if (m.getVolume) 
				u.volume = await m.getVolume(p);
			
			const el = p.element;
			const shouldPause = pause || el.hasAttribute('data-ad-global-pause');
			const duckAttr = el.getAttribute('data-ad-ducking');
			const shouldDuck = ! shouldPause && duckAttr != null;
			let prev;
			if (shouldDuck && m.getVolume && m.setVolume) {
				prev = await m.getVolume(p);
				await m.setVolume(p, + duckAttr || 0.25);
			}
			p.ADPlaying = true;
			speechSynthesis.speak(u);
			if (shouldPause && m.control) 
				m.control(p, 'pause');
			

			u.onend = async () => {
				if (shouldPause && m.control) 
					m.control(p, 'play');
				
				if (shouldDuck && m.setVolume) 
					await m.setVolume(p, prev);
				
				setTimeout(() => p.ADPlaying = false, 100);
			};
		},

		setupADTrack(p, src) {
			return new Promise(resolve => {
				const v = document.createElement('video');
				v.preload = 'metadata';
				v.style.display = 'none';
				document.body.appendChild(v);
				const t = Object.assign(document.createElement('track'), {
					kind: 'descriptions',
					label: 'Audio Descriptions',
					srclang: 'en',
					src
				});
				v.appendChild(t);
				const tt = v.textTracks[0];
				tt.mode = 'hidden';
				v.load();
				t.addEventListener('load', () => {
					p.videoElementProxy = v;
					p.ADTrack = tt;
					resolve();
				}, {once: true});
			});
		},

		async createExternalTracksFor(p) {
			if (p.element.dataset.adVideoSource) 
				return;
			 // alternate AD video — no VTT proxy needed
			await this.setupADTrack(p, p.element.dataset.adPlayerVttPath);
		},

		createPlayerMappings() {
			document.querySelectorAll('[data-AD-player]').forEach(el => {
				const name = el.id,
					type = el.dataset.adPlayerType;
				let standardSource = el.querySelector('source') ?. src || el.src;
				if (type === 'youtube') {
					const m = /embed\/([^?]+)/.exec(el.src);
					standardSource = m ? m[1] : '';
				}
				en.players[name] = {
					element: el,
					type,
					standardSource,
					ADSource: el.dataset.adVideoSource,
					enabled: false,
					ADPlaying: false
				};
			});
		},

		async buildAudioDescriptions() {
			const els = document.querySelectorAll('[data-AD-player]');
			if (! els.length) 
				return;
			

			for (const p of Object.values(this.players)) {
				await this.ensure(p.type);
				const mod = this.mods[p.type];
				if (mod && mod.setup) 
					mod.setup(p, this);
				 // pass base for helpers
			}
		},

		setupToggleButtons() {
			document.querySelectorAll('[data-AD-button]').forEach(btn => {
				btn.addEventListener('click', e => {
					const el = e.currentTarget,
						player = this.players[el.dataset.adAssociatedPlayer];
					player.enabled = ! player.enabled;
					el.classList.toggle('active');
					el.setAttribute(
						'aria-label',
						`Turn ${
							player.enabled ? 'off' : 'on'
						} audio descriptions`
					);
					const mod = this.mods[player.type];
					if (player.ADSource && mod ?. updateSource) 
						mod.updateSource(player, player.enabled ? 'AD' : 'standard');
					 else if (mod ?. setHTML5TrackMode) 
						mod.setHTML5TrackMode(player);
					
				});
			});
		}
	};

	// bootstrap
	document.addEventListener('DOMContentLoaded', () => {
		en.createPlayerMappings();
		en.buildAudioDescriptions();
		en.setupToggleButtons();
	});

})(window);
