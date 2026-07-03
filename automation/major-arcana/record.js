#!/usr/bin/env node
// Records one "draw 3 cards from the Major Arcana" take against the local app,
// producing a raw .webm screen recording plus metadata.json with the exact
// timestamps of every tap/reveal so the edit step can sync captions precisely.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const cfg = require('./lib/config');
const { normalizeCardName, koreanKeyFor } = require('./lib/cardMeanings');

function parseArgs(argv) {
  const args = { question: '', dir: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--card') args.card = argv[++i];
    else if (a === '--question') args.question = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--dir') args.dir = true; // keep Upright/Reversed feature ON
    else if (a === '--seed-success') args.seed = 'success'; // force a guaranteed-success run (testing only)
    else if (a === '--seed-fail') args.seed = 'fail'; // force a guaranteed-miss run (testing only)
  }
  if (!args.card) throw new Error('Usage: record.js --card "THE LOVERS" --question "Are we meant to be?" --out <dir> [--dir] [--seed-success]');
  if (!args.out) throw new Error('--out <dir> is required');
  return args;
}

async function recordOnce({ card, question, outDir, keepDir, seed }) {
  const target = normalizeCardName(card);
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: cfg.viewport,
    recordVideo: { dir: outDir, size: cfg.viewport },
  });
  const page = await context.newPage();
  const t0 = Date.now();
  const elapsed = () => Date.now() - t0;
  const events = [];

  await page.goto('file://' + cfg.appPath);

  if (question) await page.fill('#question-input', question);

  // Wait for the splash screen's pointer-events:none state before interacting underneath it.
  // (See index.html: splash gets the .hide class ~2.2s after load.)
  await page.waitForSelector('#splash.hide', { timeout: cfg.timingMs.splashWaitTimeout }).catch(() => {});
  await page.waitForTimeout(cfg.timingMs.afterSplashBuffer);

  await page.click('#tab-maj');
  if (!keepDir) {
    // The real <input id="dir-switch"> is visually hidden (opacity:0, 0x0) behind
    // a styled .dir-slider sibling, which is the actual clickable toggle target.
    const checked = await page.locator('#dir-switch').isChecked();
    if (checked) await page.click('#dir-toggle-wrap .dir-slider');
  }
  await page.waitForTimeout(cfg.timingMs.afterTabSwitch);
  events.push({ type: 'tab_switch', t: elapsed() });

  const total = cfg.drawCount;
  const usedIdx = new Set();
  const draws = [];

  // Optional deterministic helper for local testing: read the shuffled order via
  // the page's own `state` global (top-level `let` is visible to page.evaluate)
  // and pick indices that guarantee a hit/miss. Production runs should omit this
  // flag and let the real shuffle decide, per the handover doc.
  let forcedOrder = null;
  if (seed) {
    const koKey = koreanKeyFor(target);
    const hitIdx = await page.evaluate((key) => {
      return state.maj.findIndex(c => c.name === key);
    }, koKey);
    if (seed === 'success') {
      const others = [...Array(22).keys()].filter(i => i !== hitIdx);
      // Target card appears on the last draw for maximum suspense
      forcedOrder = [...others.slice(0, total - 1), hitIdx, ...others.slice(total - 1)];
    }
    else forcedOrder = [...Array(22).keys()].filter(i => i !== hitIdx);
  }

  for (let i = 0; i < total; i++) {
    let idx;
    if (forcedOrder) {
      idx = forcedOrder[i];
    } else {
      do { idx = Math.floor(Math.random() * 22); } while (usedIdx.has(idx));
    }
    usedIdx.add(idx);

    const cardLocator = page.locator('#canvas .card').nth(idx);
    await cardLocator.click();
    events.push({ type: 'tap_flip', drawIndex: i, t: elapsed() });

    const isLast = i === total - 1;
    await page.waitForTimeout(cfg.timingMs.flipReveal);

    const name = (await cardLocator.locator('.card-name').textContent() || '').trim();
    // .dir-tag only exists in the DOM when the Upright/Reversed toggle is on; with a
    // short explicit timeout so a missing element fails fast instead of hitting the
    // default 30s actionability wait.
    const dirTag = keepDir
      ? await cardLocator.locator('.dir-tag').textContent({ timeout: 500 }).catch(() => null)
      : null;
    events.push({ type: 'reveal', drawIndex: i, t: elapsed(), name, dir: dirTag });

    await cardLocator.click();
    events.push({ type: 'tap_popup', drawIndex: i, t: elapsed() });

    const holdMs = isLast ? cfg.timingMs.finalPopupHold : cfg.timingMs.popupHold;
    await page.waitForTimeout(holdMs);
    events.push({ type: 'popup_hold_end', drawIndex: i, t: elapsed() });

    draws.push({ drawIndex: i, name, dir: dirTag, isMatch: normalizeCardName(name) === target });

    if (!isLast) {
      await page.evaluate(() => closeCardPopup());
      events.push({ type: 'popup_close', drawIndex: i, t: elapsed() });
      await page.waitForTimeout(cfg.timingMs.closeGap);
    }
    // Last draw: popup stays open as the CTA backdrop; recording stops while it's showing.
  }

  const success = draws.some(d => d.isMatch);
  const successDrawIndex = success ? draws.find(d => d.isMatch).drawIndex : null;
  const durationMs = elapsed();

  const video = page.video();
  await context.close();
  const rawVideoPath = await video.path();
  await browser.close();

  const metadata = {
    card: target,
    question,
    success,
    successDrawIndex,
    draws,
    events,
    durationMs,
    viewport: cfg.viewport,
    rawVideoPath,
  };
  fs.writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  return metadata;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  recordOnce({ card: args.card, question: args.question, outDir: args.out, keepDir: args.dir, seed: args.seed })
    .then((m) => {
      console.log(`Recorded: success=${m.success} draws=${m.draws.map(d => d.name).join(' | ')}`);
      console.log(`Video: ${m.rawVideoPath}`);
    })
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { recordOnce };
