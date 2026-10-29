# Neon Beat

Independent four-key browser piano rhythm game with eleven selectable short classical arrangements. Buildless HTML, CSS, and JavaScript modules; no packages or remote assets.

## Preview

Run `python3 -m http.server 8000` in this folder, then visit http://localhost:8000. ES modules require HTTP; do not open index.html directly.

Choose a song, then press Start to enable audio. The header’s 처음으로 button stops audio and returns to song selection during countdown, play, pause, and results. Play with D/F/J/K or touch the four keys. Escape pauses; switching tabs pauses automatically. Music and keyboard volumes are separate. Positive timing offset permits later input. Best score is stored locally when browser storage is available.

Easy plays roughly half the melody; omitted notes are performed automatically. Normal plays the full melody. Each judged note contributes equally to accuracy; PERFECT = 1, GOOD = 0.65, MISS = 0. Long melody notes have tails: keep the key held until the tail reaches the line. Releasing more than 100 ms early yields MISS. Normal includes occasional two-key harmonies. Each hold is scored once on completion.

## Structure

- `js/song.js`: original arrangement and deterministic chart
- `js/audio.js`: oscillator-based keyboard and percussion
- `js/game.js`: audio-clock scheduling, rendering, input and results
- `style.css`: responsive interface
- `CREDITS.md`: provenance and music rights information

Repository was empty when work began; no existing deployment configuration was present. This source is suitable for static hosting. No automatic publishing workflow is enabled.


## Updated selection and controls

- Single-row 3D carousel: previous/next buttons, click neighboring cards, left/right keys while focused, and horizontal swipe. Last/first tracks wrap around.
- Tap, hold, and Normal two-key notes. Pointer IDs are tracked independently for multitouch.
- Every ten combo triggers a celebratory label. Reduced-motion preferences disable carousel transitions.
- Music volume, keyboard volume, and timing offset persist locally. High scores are separated by song and difficulty.
- The keyboard uses original additive synthesis, a subtle generated room response, and master compression. No external samples are used.
- Run `node tests/game.test.mjs` for chart conflicts, timing, hold releases, chord input, carousel wrap, and home reset tests.

## GitHub Pages

Public game: https://guras1984.github.io/neon-beat/

Pages publishes the main branch root. `.nojekyll` serves the buildless source directly. All asset and module URLs are relative, including the /neon-beat/ project path.


## Three difficulty modes

Easy: reduced melody with tap notes only. Normal: full melody with holds and occasional simultaneous harmony. Hard: faster scroll and extra simultaneous/offbeat harmony. Each track has a strictly increasing playable note count across the three modes.

Center-CD activation animates its scale (disabled for reduced motion). Input help is inside the settings panel; D/F/J/K remain on the desktop keys. Holds are finalized at input time as well as in the render loop, and stale pointer-capture events cannot clear newly captured input. Each voice has its own release envelope.


## Fixed-scale touch controls

The viewport requests a fixed 1× scale. CSS disables pinch/double-tap zoom on the game surface; non-passive gesture and multi-touch-move handlers cover native gesture fallbacks. Settings remain pannable. Control actions share an async lock and a short repeat guard. Song, difficulty, and settings controls reject duplicate taps. Piano pointer/keyboard input has no debounce and retains multi-touch, fast repeats, and hold handling. Browser or operating-system accessibility overrides remain outside page control.


## Performance feedback and preview

- Shorter note field; Easy/Normal/Hard show approximately 2/1.65/1.25 seconds of travel regardless of field height. Input timing remains based on the audio clock.
- The combo ring advances toward 10, 25, 50, 100, then each additional 50 hits. Milestones show larger text and star/music-note particles. MISS triggers a brief bottom-lane wave. Reduced-motion preferences suppress UI animation.
- Results: S at 95% accuracy, A at 85%, B at 70%, otherwise C.
- The selected song has an explicit 8-second preview button. Changing tracks, starting the game, returning home, or leaving the tab stops preview audio.


## Combo tiers, scoring and results (scoring version 2)

READY ×1.0; NICE at 10 ×1.1; SUPER at 25 ×1.2; ULTRA at 50 ×1.3; ULTRA FEVER at 100 ×1.5; LEGEND at 150 ×1.7. A hit uses the tier reached by that hit. PERFECT base value is 1000, GOOD 650. A wrong press during play is MISS, resets combo/tier/multiplier, and is counted separately from missed notes. Auto-repeat and ongoing holds are not wrong presses. New scoring-version best-score keys avoid comparing scores from different rules.

The overall score is 70 × weighted accuracy + 20 × (max combo / chart-note count) + 10 × (successful notes / (chart-note count + wrong presses)). Weighted accuracy = (Perfect + 0.65 × Good) / (chart-note count + wrong presses). Each ratio is bounded by normal completed-chart counts. Results show the three components, individual judgments, wrong presses, max combo, best tier, score, grade and advice.

Design reference: the official osu! wiki documents accuracy and combo as distinct gameplay metrics (https://osu.ppy.sh/wiki/en/Gameplay/Accuracy and https://osu.ppy.sh/wiki/en/Gameplay/Combo_(score_multiplier)). The tier names, thresholds, UI and 70/20/10 formula here are original Neon Beat rules.

CD selection has no arrow buttons: drag/swipe follows the pointer, then snaps to the neighboring disc. Pointer capture preserves motion outside the shelf. Short drags snap back; completed drags suppress the following click; keyboard arrow navigation remains available.
