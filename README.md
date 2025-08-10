# Enscribe - Add support to Audio Descriptions for your video using WebVTT.

This library adds an audio description (AD) feature alongside popular video players. Including audio descriptions is a requirement of [WCAG accessibility AA conformance guidelines](https://www.w3.org/WAI/WCAG21/quickref/#audio-description-prerecorded). The following players are currently supported: **HTML5**, **Vimeo**, and **YouTube**.  

## Overview

This library does not modify video player functionality, but instead works with native API's and the [Web Speech Synthesis API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) to seamlessly deliver audio descriptions during playback. A separate AD version of a video can also be used in place of the Web Speech API. If detected by the library, this option will take precedence. 

Although the implementation details differ from player to player, the general approach remains the same: 
- the AX library is included as an external script (*audio-descriptions.js*)
- a [WebVTT](https://developer.mozilla.org/en-US/docs/Web/API/WebVTT_API) file containing the audio descriptions is supplied
- HTML data attributes are added to the player (`<video>` or `<iframe>`) .
- a corresponding AD `<button>` is added, also with HTML data attributes 

## How To Implement

### 1. Include the script 

There are several ways to include the script in your project.

- Put all the files in the `js` directory on your server in the same folder.
- Include the base script in your project.
<script src="js/enscribe.js"></script>
<!-- No need to add plugin scripts manually -->


### 2. Add player data attributes 
**id**: A standard ID attribute is necessary map the player to its AD button<br />
**data-AD-player**: enables AD functionality for the player. No value needed.<br />
**data-AD-player-type**: string indicating player type (html5 | vimeo | youtube)<br />
**data-AD-video-source**: (optional) source path to alternate video with audio descriptions. Full URL for HTML5 and video ID for Vimeo & YouTube.
**data-AD-global-pause**: (optional) if set, will globally pause the video when the browser says an audio description with speech synthesis. 

### 3. Specify VTT Path:

Vimeo & YouTube: **data-AD-player-VTT-path**: source path to VTT audio descriptions file<br />
HTML5: a `<track>` element linking the VTT file is enclosed within the `<video>` tag:

 
### 4. Add AD button and attributes

Include an AD `<button>`<br />
**data-AD-button**: enables toggling of AD functionality. No value needed.<br />
**data-AD-associated-player**: ID of corresponding player. Maps button to correct player (in the event multiple players exist on the page)

## Example code

**HTML5**:

    <video 
      id="player-1"
      data-AD-player
      data-AD-player-type="html5" 
      data-AD-video-source="https://www.domain.com/ad-video.mp4"
      controls>
      <source src="https://domain.com/video.mp4"
        type="video/mp4">
      <track src="vtt/audio-descriptions.vtt" kind="descriptions" srclang="en" label="Audio Descriptions">
    </video>
    <button 
      data-AD-button
      data-AD-associated-player="player-1"
      aria-label="Turn on audio descriptions">
    </button>

**Vimeo**: 

    <iframe 
      id="player-1"
      data-AD-player
      data-AD-player-type="vimeo" 
      data-AD-player-VTT-path="audio-descriptions.vtt"
      data-AD-video-source="72675442"
      src="https://player.vimeo.com/video/76979871?h=8272103f6e" width="640" height="360" frameborder="0"
      allowfullscreen allow="autoplay; encrypted-media"></iframe>
    <button 
      data-AD-button
      data-AD-associated-player="player-1"
      aria-label="Turn on audio descriptions">
    </button>

**YouTube**: 

    <iframe 
      id="player-1" 
      autoplay 
      width="560" height="315"
      data-AD-player
      data-AD-player-type="youtube" 
      data-AD-player-VTT-path="youtube-audio-descriptions.vtt"
      src="https://www.youtube.com/embed/MfLXHHeUS2s?enablejsapi=1" 
      title="YouTube video player" frameborder="0"
      allowfullscreen"></iframe>
    <button 
      data-AD-button
      data-AD-associated-player="player-1"
      aria-label="Turn on audio descriptions">
    </button>

**For YouTube, the value '?enablejsapi=1' needs to be appended to the src attribute to enable the player API.

## Development Environment

Run a local dev server in the project root and visit *index.html* in a browser. The index page links to an example for each player. The NPM package [http-server](https://www.npmjs.com/package/http-server) works well.   


## A note on how to advanced authoring of VTT files for Audio Descriptions:  
You can author the VTT files just like ones used for captioning, e.g.,

```
Cue-1
00:00.500 --> 00:01.000
The words "How are you gentlemen?" appear on screen.

Cue-2
00:06.500 --> 00:07.500
The words "All your base are belong to us" appear on screen.
```

However, this will result in the dialog being spoken over the audio track of the video.  To prevent this from happening, you can do one of two things:

1. use Custom Marker Prefixes in Cue Text:

```
Cue-1
00:00.500 --> 00:01.000
<c.pause>The words "How are you gentlemen?" appear on screen.</c>

Cue-2
00:06.500 --> 00:07.500
<c.pause>The words "All your base are belong to us" appear on screen.</c>
```

2. use the `data-AD-pause-when-reading` attribute in the video or iframe tag that you are using to embed the video into the page.  This will cause the pausing behaviour to happen by default, unless there is a `<c.play>` tag in the audio description text.

## Important to Note

- Captions can be included alongside for the HTML5 player using the `<track>` tag. 
- This library is written in pure vanilla JS to prevent dependency conflicts. 
- Use of multiple players is supported. However, use of multiple player types is not. For example, audio descriptions will not simultaneously work for both an HTML5 player and a Vimeo player on the same web page. 
