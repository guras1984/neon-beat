# Neon Beat

Independent four-key browser piano rhythm game. Buildless HTML, CSS, and JavaScript modules; no packages or remote assets.

## Preview

Run `python3 -m http.server 8000` in this folder, then visit http://localhost:8000. ES modules require HTTP; do not open index.html directly.

Press Start to enable audio. Play with D/F/J/K or touch the four keys. Escape pauses; switching tabs pauses automatically. Music and keyboard volumes are separate. Positive timing offset permits later input. Best score is stored locally when browser storage is available.

Easy plays roughly half the melody; omitted notes are performed automatically. Normal plays the full melody. Each judged note contributes equally to accuracy; PERFECT = 1, GOOD = 0.65, MISS = 0. No holds are included in this first prototype.

## Structure

- `js/song.js`: original arrangement and deterministic chart
- `js/audio.js`: oscillator-based keyboard and percussion
- `js/game.js`: audio-clock scheduling, rendering, input and results
- `style.css`: responsive interface
- `CREDITS.md`: provenance and music rights information

Repository was empty when work began; no existing deployment configuration was present. This source is suitable for static hosting. No automatic publishing workflow is enabled.
