// Create a Player Mappings Object to Manage and Track All Players

let players = {};

function createPlayerMappings() {
	const playerElements = document.querySelectorAll('[data-AD-player]');
	for (const player of playerElements) {
		const name = player.id;
		const type = player.dataset.adPlayerType;
		let standardSource;
		switch (type) {
			case 'html5': standardSource = player.getElementsByTagName("source")[0].src;
				break;
			case 'vimeo': standardSource = player.src;
				break;
			case 'youtube':
				let standardSourcePath = player.src;
				standardSource = standardSourcePath.substring(standardSourcePath.lastIndexOf("embed/") + 6, standardSourcePath.lastIndexOf("?enablejsapi=1"));
				break;
		}
		const ADSource = player.dataset.adVideoSource;
		players[name] = {
			element: player, // Players HTML element
			videoElementProxy: undefined, // Create a proxy <video> element so Vimeo + YouTube can use VTT file
			vimeo: undefined, // Vimeo player object
			youtube: undefined, // YouTube player object
			type: type, // Type of player (HTML/YouTube/Vimeo)
			enabled: false, // Whether the AD is enabled
			ADTrack: undefined, // The AD Track object
			startTimes: [], // YouTube - start times for AD speaking
			ADPlaying: false, // YouTube - whether AD is being spoken
			standardSource: standardSource, // Source path for standard video
			hasADVideo: false, // Whether player has an alternate AD video
			ADSource: ADSource, // Source path/ID for AD video
		};
		if (type === "html5") {
			players[name].element.textTracks.addEventListener('change', (event) => {
				setHTML5TrackMode(players[name]);
			});
		}
	}
}

// Ensure AD remains enabled for HTML5 players once captions are turned off

function setHTML5TrackMode(player) {
	player.ADTrack.mode = player.enabled ? 'showing' : 'disabled';
}

createPlayerMappings();

// Global Audio Descriptions (AD) variables

let playerType = undefined;

/* --- Shared --- */

// Helper functions
function htmlToText(html) { // Create a temporary DOM node to strip tags
	const div = document.createElement('div');
	div.appendChild(html.cloneNode(true));
	return div.textContent || '';
}

function getCueData(activeCue) {
	const htmlContent = activeCue.getCueAsHTML();
	const content = htmlToText(htmlContent);
	const pause = htmlContent.querySelector('span.pause') !== null
	return {content, pause};
}

// Speak Utility

function speak(content, pause, playerType, player) {
	const spokenContent = new SpeechSynthesisUtterance(content);
	player.ADPlaying = true;
	window.speechSynthesis.speak(spokenContent);
	if (pause) {
		switch (playerType) {
			case 'html5': player.element.pause()
				break;
			case 'vimeo': player.vimeo.pause()
				break;
			case 'youtube': player.youtube.pauseVideo()
				break;
		}
	}
	spokenContent.onend = function (event) {
		if (pause) {
			switch (playerType) {
				case 'html5': player.element.play()
					break;
				case 'vimeo': player.vimeo.play()
					break;
				case 'youtube': player.youtube.playVideo()
					break;
			}
		}
		setTimeout(function () {
			player.ADPlaying = false;
		}, 500)
	}
}

/* --- YouTube --- */

// Create AD Track Object

function createYouTubeADTracks() {
	for (const name in players) {
		const player = players[name];
		player["videoElementProxy"] = document.createElement('video');
		const track = document.createElement("track");
		track.kind = "descriptions";
		track.label = "Audio Descriptions";
		track.srclang = "en";
		const element = player.element;
		track.src = element.dataset.adPlayerVttPath;
		player["videoElementProxy"].appendChild(track);
		var textTrack = player["videoElementProxy"].textTracks[0];
		textTrack.mode = "showing";
		player["ADTrack"] = textTrack;
	}
}

/* --- Vimeo --- */

// Set Cues

function setVimeoCues() {
	for (const name in players) {
		const player = players[name];
		const ADTrack = player.ADTrack;
		if (! ADTrack) 
			continue;
		

		player.vimeo = new Vimeo.Player(player.element);

		for (const entry of ADTrack.cues) {
			const {content, pause} = getCueData(entry);
			player.vimeo.addCuePoint(entry.startTime, {pause, content});
		}
	}
}

// Load Player API

function loadVimeoPlayerAPI(createVimeoTracks) {
	var script = document.createElement('script');
	script.type = "text/javascript";
	script.onload = (function () {
		createVimeoTracks();
	})
	script.src = "https://player.vimeo.com/api/player.js";
	document.head.appendChild(script);
}

// Create Vimeo AD Tracks

function createVimeoTracks() {
	for (const name in players) {
		var player = players[name];
		player["videoElementProxy"] = document.createElement('video');
		const track = document.createElement("track");
		track.kind = "descriptions";
		track.label = "Audio Descriptions";
		track.srclang = "en";
		const element = player.element;
		track.src = element.dataset.adPlayerVttPath;
		player["videoElementProxy"].appendChild(track);
		var textTrack = player["videoElementProxy"].textTracks[0];
		textTrack.mode = "showing";
		player["ADTrack"] = textTrack;
		console.log('adtrack', player.ADTrack);
	}
}

/* --- YouTube --- */

// Load iFrame API

function loadYouTubeiFrameAPI() {
	var tag = document.createElement('script');
	tag.id = 'iframe-demo';
	tag.src = 'https://www.youtube.com/iframe_api';
	var firstScriptTag = document.getElementsByTagName('script')[0];
	firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

// Get AD Start Times

function getYouTubeADStartTimes() {
	for (const name in players) {
		const player = players[name];
		player.startTimes = [];
		for (const audioDescription of player.ADTrack.cues) {
			const time = audioDescription.startTime;
			player.startTimes.push(time);
		}
	}
}

// SetInterval to Poll Video Time and Conditionally Speak AD

function onYouTubePlayerReady(event) {
	for (const name in players) {
		if (! players[name].element.dataset.adVideoSource) {
			const player = players[name];
			setInterval(function () {
				if (! player.youtube.getCurrentTime) 
					return;
				 // stop execution of player not yet loaded
				const currentTime = player.youtube.getCurrentTime();
				for (const [index, timestamp] of player.startTimes.entries()) {
					if (! player.enabled) 
						return;
					
					if (player.ADPlaying === false) {
						if ((timestamp <= currentTime + .1) && (timestamp >= currentTime - .1)) {
							var AD = player.ADTrack.cues[index];
							const {content, pause} = getCueData(AD);

							speak(content, pause, "youtube", player);
						}
					}
				}
			}, 100)
		}
	}
}

/* Update source video */

function updateSourceVideo(version, player) {
	let src = version == 'AD' ? player.ADSource : player.standardSource;
	let videoSourceElement,
		currentTime,
		isPaused;
	switch (player.type) {
		case 'html5': videoSourceElement = player.element.getElementsByTagName("source")[0];
			currentTime = player.element.currentTime;
			isPaused = player.element.paused;
			videoSourceElement.setAttribute('src', src);
			player.element.load();
			player.element.currentTime = currentTime;
			if (! isPaused) 
				player.element.play();
			
			break;
		case 'vimeo': player.vimeo.getPaused().then(function (paused) {
				isPaused = paused;
			});
			player.vimeo.getCurrentTime().then(function (seconds) {
				currentTime = seconds;
			}).catch(function (error) {});
			player.vimeo.loadVideo(src).then(function () {
				player.vimeo.setCurrentTime(currentTime).then(function () {
					if (! isPaused) 
						player.vimeo.play();
					
				});
			}).catch(function (error) {});
			break;
		case 'youtube':
			{
				const playerState = player.youtube.getPlayerState();
				if (playerState == 1) 
					isPaused = false;
				
				if (playerState == 2) 
					isPaused = true;
				
				currentTime = player.youtube.getCurrentTime();
				player.youtube.loadVideoById(src, currentTime)
				const pollPlayerState = setInterval(function () {
					if (player.youtube.getPlayerState() == -1) {
						if (isPaused) {
							player.youtube.pauseVideo()
						} else {
							player.youtube.playVideo();
						}
						clearInterval(pollPlayerState);
					}
				}, 100)
			}
	}
}

/* --- Build Audio Descriptions ---*/

function buildAudioDescriptions() { // Only run if AD attribute exists
	const dataADPlayers = document.querySelectorAll('[data-AD-player]');
	if (dataADPlayers.length === 0) 
		return
	
	// Set player type
	playerType = dataADPlayers[0].getAttribute('data-AD-player-type');

	switch (playerType) {
		case 'html5':
			for (const name in players) {
				if (! players[name].element.dataset.adVideoSource) {
					var textTracks = players[name].element.textTracks;
					for (const track of textTracks) {
						if (track.kind === "descriptions") {
							players[name].ADTrack = track;
							track.addEventListener('cuechange', (event) => {
								if (players[name].ADPlaying === true) 
									return;
								
								const activeCue = event.currentTarget.activeCues[0];
								if (activeCue) {
									const {content, pause} = getCueData(activeCue);
									speak(content, pause, "html5", players[name]);
								}
							})
						}
					}
				}
			}
			break;

		case 'vimeo': loadVimeoPlayerAPI(createVimeoTracks);
			window.addEventListener('load', function () {
				setVimeoCues();
				for (const name in players) {
					if (! players[name].element.dataset.adVideoSource) {
						const player = players[name];
						player.vimeo.on('cuepoint', function (cue) {
							const {content, pause} = cue.data;
							if (player.enabled) {
								speak(content, pause, "vimeo", player);
							}
						});
					}
				}
			})
			break;

			// YouTube

		case 'youtube': createYouTubeADTracks();
			loadYouTubeiFrameAPI();
			window.onYouTubeIframeAPIReady = function () {
				for (const name in players) {
					const player = players[name];
					player.youtube = new YT.Player(player.element.id, {
						events: {
							'onReady': onYouTubePlayerReady
						}
					})
				}
			}
			window.addEventListener('load', function () {
				getYouTubeADStartTimes();
			});
			break;
	}
}

buildAudioDescriptions();

// Enabled Audio Descriptions When AD is Clicked

const ADButtons = document.querySelectorAll('[data-AD-button]');

for (const ADButton of ADButtons) {
	ADButton.addEventListener("click", (e) => {

		const name = e.target.getAttribute("data-AD-associated-player");
		const player = players[name];
		player.enabled = ! player.enabled;
		ADButton.classList.toggle("active");
		let ariaLabel;
		if (player.enabled) 
			ariaLabel = 'Turn off audio descriptions';
		 else 
			ariaLabel = 'Turn on audio descriptions'
		 ADButton.setAttribute('aria-label', ariaLabel);

		if (player.element.dataset.adVideoSource) {

			const videoType = player.enabled ? 'AD' : 'standard';
			updateSourceVideo(videoType, player)
		} else if (playerType === "html5") {
			setHTML5TrackMode(players[name]);
		}
	});
}
