# Major Arcana Shorts Automation

Pipeline for producing the "if THIS card appears... it's a sign" YouTube
Shorts that promote the Starlight Tarot Room app. Drives the app's own
`index.html` (via Playwright, over `file://`) to record a real draw, then
composites captions and SFX with ffmpeg. BGM and the actual YouTube upload
stay manual steps.

This is one of (potentially) multiple independent automation pipelines living
side by side under `automation/` — this one is scoped specifically to the
22-card Major Arcana deck with static caption pools. It has its own
`package.json` and dependencies; it doesn't share anything with sibling
pipelines.

## Setup

```
cd automation/major-arcana
npm install
```

Requires `ffmpeg` and a Playwright-compatible Chromium on the host (already
present in this environment). Only the 22-card Major Arcana deck is
supported — `lib/cardMeanings.js`'s Korean-key map only covers those cards.

## One-shot pipeline

```
node run.js --card "THE LOVERS" --question "Are we meant to be?"
```

Produces `output/<card-slug>/`:
- `metadata.json` — every tap/reveal timestamp from the recording
- `<hash>.webm` — raw Playwright screen recording (540x960)
- `final.mp4` — finished 1080x1920 short with captions + tick SFX
- `thumbnail.png` — 1080x1920 thumbnail showing the target card + question (never spoils the draw outcome)
- `meta.json` — YouTube title/description/hashtags

Flags:
- `--dir` — keep the Upright/Reversed toggle on (off by default)
- `--seed-success` / `--seed-fail` — force a guaranteed hit/miss, for testing the pipeline only; never use for a real upload, since the outcome must come from the app's real shuffle
- `--outRoot <dir>` — override the output root (default `automation/output`)

## Individual stages

Each stage is also a standalone CLI if you want to re-run just one step:

```
node record.js --card "THE LOVERS" --question "Are we meant to be?" --out output/lovers
node edit.js --in output/lovers --out output/lovers/final.mp4
node thumbnail.js --card "THE LOVERS" --question "Are we meant to be?" --out output/lovers/thumbnail.png
node meta.js --card "THE LOVERS" --question "Are we meant to be?"
```

## How it fits together

- `record.js` drives the app: switches to the Major Arcana tab, taps 3 random
  cards from the shuffled grid (flip, then tap again for the popup), and logs
  every event's timestamp plus which cards were drawn.
- `lib/plan.js` turns that `metadata.json` into a caption timeline (text +
  start/end seconds + vertical position) and a list of SFX tick timestamps,
  using the reaction/result/CTA copy pools in `lib/captions.js`.
- `edit.js` upscales the raw recording to 1080x1920, burns in the caption
  plan via ffmpeg `drawtext` (one filter per caption, `enable='between(t,...)'`),
  and mixes in `assets/tick.wav` at every tap.
- `thumbnail.js` and `meta.js` don't depend on the recording at all — they
  call the app's `openCardPopup()` directly to show the target card, so the
  thumbnail/title never give away whether the actual take hit or missed.

## Series

`lib/cardMeanings.js` has the confirmed 6-video series lineup (`SERIES`) for
batching future videos by hand:

```js
const { SERIES } = require('./lib/cardMeanings');
for (const { card, question } of SERIES) {
  await runOnce({ card, question, outRoot: 'output' });
}
```
