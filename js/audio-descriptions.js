/* 
  enscribe.js - a script that allows web page authors to produce audio descriptions
  for HTML5, YouTube and Vimeo videos using WebVTT.  Part of the Enable Project at 
  http://www.useragentman.com/enable/

  Programmers: Jeremy Burr, Zoltan Hawryhluk

  Released under the MIT License.
*/

const players = {};

function htmlToText(html) {
	const div = document.createElement('div');
	div.appendChild(html.cloneNode(true));
	return div.textContent || '';
}

function getCueData(cue) {
	const html = cue.getCueAsHTML();
	return {
		content: htmlToText(html),
		pause: html.querySelector('span.pause') !== null
	};
}

const getVol = (t, p) => t === 'html5' ? Promise.resolve(p.element.volume) : t === 'youtube' ? Promise.resolve(p.youtube.getVolume() / 100) : p.vimeo.getVolume(); // Vimeo: Promise

const setVol = (t, p, v) => t === 'html5' ? (p.element.volume = v) : t === 'youtube' ? p.youtube.setVolume(Math.round(v * 100)) : p.vimeo.setVolume(v);


async function speak(content, pause, type, player) {
	const u = new SpeechSynthesisUtterance(content);
	u.volume = await getVol(type, player);

	const el = player.element;
	const shouldPause = pause || el.hasAttribute('data-ad-global-pause');
	const duckAttr = el.getAttribute('data-ad-ducking');
	const shouldDuck = ! shouldPause && duckAttr != null;
	let prev;

	if (shouldDuck) {
		prev = await getVol(type, player);
		await setVol(type, player, + duckAttr || 0.25);
	}

	player.ADPlaying = true;
	speechSynthesis.speak(u);
	if (shouldPause) 
		control(type, player, 'pause');
	


	u.onend = async () => {
		if (shouldPause) 
			control(type, player, 'play');
		
		// we paused -> resume
		if (shouldDuck) 
			await setVol(type, player, prev);
		
		// restore ducking
		setTimeout(() => player.ADPlaying = false, 100); // small guard
	};
}


function control(type, player, action) {
	if (type === 'youtube') 
		return player.youtube[action + 'Video']();
	

	if (type === 'vimeo') 
		return player.vimeo[action]();
	

	return player.element[action](); // html5
}


function setupADTrack(player, src) {
	return new Promise(resolve => {
		const video = document.createElement('video');
		video.preload = 'metadata';
		video.style.display = 'none';
		document.body.appendChild(video);

		const track = Object.assign(document.createElement('track'), {
			kind: 'descriptions',
			label: 'Audio Descriptions',
			srclang: 'en',
			src
		});
		video.appendChild(track);

		const tt = video.textTracks[0];
		tt.mode = 'hidden';
		video.load();

		track.addEventListener('load', () => {
			player.videoElementProxy = video;
			player.ADTrack = tt;
			resolve(); // <- cues ready
		}, {once: true});
	});
}


async function createExternalTracksFor(player) {
	if (player.element.dataset.adVideoSource) 
		return;
	
	// nothing to do
	await setupADTrack(player, player.element.dataset.adPlayerVttPath);
}


function createPlayerMappings() {
	document.querySelectorAll('[data-AD-player]').forEach(player => {
		const name = player.id;
		const type = player.dataset.adPlayerType;
		let standardSource = player.querySelector('source') ?. src || player.src;
		if (type === 'youtube') {
			const m = /embed\/([^?]+)/.exec(player.src);
			standardSource = m ? m[1] : '';
		}
		players[name] = {
			element: player,
			type,
			standardSource,
			ADSource: player.dataset.adVideoSource,
			enabled: false,
			ADPlaying: false
		};
		if (type === 'html5') {
			player.textTracks.addEventListener('change', () => setHTML5TrackMode(players[name]));
		}
	});
}

function setHTML5TrackMode(player) {
	player.ADTrack.mode = player.enabled ? 'showing' : 'disabled';
}

const api = {
	html5: {
		get: p => (
			{currentTime: p.element.currentTime, isPaused: p.element.paused}
		),
		set: (p, s, t, pause) => {
			const src = p.element.querySelector('source');
			src.src = s;
			p.element.load();
			p.element.currentTime = t;
			if (!pause) 
				p.element.play();
			

		}
	},
	vimeo: {
		get: async p => (
			{currentTime: await p.vimeo.getCurrentTime(), isPaused: await p.vimeo.getPaused()}
		),
		set: async (p, s, t, pause) => {
			await p.vimeo.loadVideo(s);
			await p.vimeo.setCurrentTime(t);
			if (!pause) 
				p.vimeo.play();
			

		}
	},
	youtube: {
		get: p => (
			{
				currentTime: p.youtube.getCurrentTime(),
				isPaused: p.youtube.getPlayerState() === 2
			}
		),
		set: (p, s, t, pause) => {
			p.youtube.loadVideoById(s, t);
			const poll = setInterval(() => {
				if (p.youtube.getPlayerState() === -1) {
					pause ? p.youtube.pauseVideo() : p.youtube.playVideo();
					clearInterval(poll);
				}
			}, 100);
		}
	}
};

async function updateSourceVideo(version, player) { // ensure platform player exists
	if (player.type === 'youtube' && ! player.youtube) 
		await setupYouTube(player);
	
	if (player.type === 'vimeo' && ! player.vimeo) 
		await setupVimeo(player);

	const {currentTime, isPaused} = await api[player.type].get(player);
	const src = version === 'AD' ? player.ADSource : player.standardSource;
	await api[player.type].set(player, src, currentTime, isPaused);

}


function setupHTML5(p) {
	for (const track of p.element.textTracks) {
		if (track.kind !== 'descriptions') 
			continue;
		

		p.ADTrack = track;
		track.addEventListener('cuechange', async e => {
			if (p.ADPlaying) 
				return;
			

			const cue = e.currentTarget.activeCues[0];
			if (cue) 
				await speak(...Object.values(getCueData(cue)), 'html5', p);
	
		});
	}
}


async function setupVimeo(p) {
	await createExternalTracksFor(p); // returns immediately if AD video source
	await loadScript('https://player.vimeo.com/api/player.js');
	p.vimeo = new Vimeo.Player(p.element);

	if (p.ADTrack) { // only when tracks exist
		for (const cue of p.ADTrack.cues) {
			const {content, pause} = getCueData(cue);
			p.vimeo.addCuePoint(cue.startTime, {content, pause});
		}
		p.vimeo.on('cuepoint', e => p.enabled && speak(e.data.content, e.data.pause, 'vimeo', p));
	}
}

let ytReady;
function loadYouTube() {
	if (ytReady) 
		return ytReady;
	

	ytReady = new Promise(res => {
		window.onYouTubeIframeAPIReady = res;
		loadScript('https://www.youtube.com/iframe_api');
	});
	return ytReady;
}

async function setupYouTube(p) {
	await createExternalTracksFor(p);
	await loadYouTube();
	p.youtube = new YT.Player(p.element.id, {
		events: {
			onStateChange: (e) => {
				if (e.data !== YT.PlayerState.UNSTARTED && ! p._pollStarted && ! p.element.dataset.adVideoSource) {
					p._pollStarted = true;
					pollYouTubeAD(p);
				}
			}
		}
	});
}

function buildAudioDescriptions() {
	const els = document.querySelectorAll('[data-AD-player]');
	if (! els.length) 
		return;
	


	for (const p of Object.values(players)) {
		if (p.type === 'html5') { // Only HTML5 needs the descriptions track on the main element
			if (! p.element.dataset.adVideoSource) 
				setupHTML5(p);
			

		} else if (p.type === 'vimeo') {
			setupVimeo(p); // always create the Vimeo player
		} else if (p.type === 'youtube') {
			setupYouTube(p); // always create the YT player
		}
	}
}


function pollYouTubeAD(p){
  const tick=()=>{
    if(!p.enabled||p.ADPlaying||!p.youtube?.getCurrentTime) return;
    const now=p.youtube.getCurrentTime();
    if(p._lastTime!=null && now<p._lastTime-0.2) p._recentCue = undefined; // rewound
    p._lastTime = now;

    for(const c of p.ADTrack.cues){
      if (p._recentCue === c.startTime) continue;            // skip the one we just said
      if (Math.abs(now - c.startTime) <= 0.1) {
        p._recentCue = c.startTime;
        return speak(...Object.values(getCueData(c)),'youtube',p);
      }
    }
  };
  p._ytInterval=setInterval(tick,100);
}



function loadScript(src) {
	return new Promise(r => {
		const s = document.createElement('script');
		s.onload = r;
		s.src = src;
		document.head.appendChild(s);
	});
}

function setupToggleButtons() {
	document.querySelectorAll('[data-AD-button]').forEach(btn => {
		btn.addEventListener('click', e => {
			const el = e.currentTarget;
			const name = el.dataset.adAssociatedPlayer;
			const player = players[name];
			player.enabled = ! player.enabled;
			el.classList.toggle('active');
			el.setAttribute('aria-label', `Turn ${
				player.enabled ? 'off' : 'on'
			} audio descriptions`);
			if (player.ADSource) 
				updateSourceVideo(player.enabled ? 'AD' : 'standard', player);
			 else if (player.type === 'html5') 
				setHTML5TrackMode(player);
			

		});
	});
}

createPlayerMappings();
buildAudioDescriptions();
setupToggleButtons();
