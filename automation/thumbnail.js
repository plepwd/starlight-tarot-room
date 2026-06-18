#!/usr/bin/env node
// Generates a static thumbnail for a card+question combo by opening the target
// card's popup directly (bypassing the random draw grid entirely, so the
// thumbnail never reveals whether the actual recorded take hit or missed).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const cfg = require('./lib/config');
const { normalizeCardName, koreanKeyFor } = require('./lib/cardMeanings');
const { wordWrap } = require('./lib/wrap');
const { FONT, FONT_SIZE, MAX_CHARS } = require('./lib/style');

const FINAL_SIZE = { width: 1080, height: 1920 };

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--card') args.card = argv[++i];
    else if (a === '--question') args.question = argv[++i];
    else if (a === '--out') args.out = argv[++i];
  }
  if (!args.card) throw new Error('Usage: thumbnail.js --card "THE LOVERS" --question "Are we meant to be?" --out <file.png>');
  if (!args.out) throw new Error('--out <file.png> is required');
  return args;
}

async function captureCardPopup(card) {
  const target = normalizeCardName(card);
  const koKey = koreanKeyFor(target);
  if (!koKey) throw new Error(`No Korean key mapping for "${target}" (is it a Major Arcana card?)`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: cfg.viewport });
  const page = await context.newPage();
  await page.goto('file://' + cfg.appPath);
  await page.waitForSelector('#splash.hide', { timeout: cfg.timingMs.splashWaitTimeout }).catch(() => {});
  await page.waitForTimeout(cfg.timingMs.afterSplashBuffer);
  await page.click('#tab-maj');
  await page.waitForTimeout(cfg.timingMs.afterTabSwitch);

  await page.evaluate((key) => openCardPopup(key, 'maj', undefined), koKey);
  await page.waitForTimeout(400); // let the popup's CSS transition settle

  const buf = await page.screenshot();
  await browser.close();
  return buf;
}

async function buildThumbnail({ card, question, out }) {
  const target = normalizeCardName(card);
  const shotBuf = await captureCardPopup(target);

  const workDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'thumb-'));
  const rawPng = path.join(workDir, 'raw.png');
  fs.writeFileSync(rawPng, shotBuf);

  const topFile = path.join(workDir, 'top.txt');
  const bottomFile = path.join(workDir, 'bottom.txt');
  fs.writeFileSync(topFile, wordWrap(`"${question}"`, MAX_CHARS));
  fs.writeFileSync(bottomFile, wordWrap('if THIS card appears...\nit\'s a sign', MAX_CHARS));

  const filterLines = [
    `[0:v]scale=${FINAL_SIZE.width}:${FINAL_SIZE.height}:flags=lanczos,setsar=1[v0]`,
    `[v0]drawtext=fontfile=${FONT}:textfile=${topFile}:fontsize=${FONT_SIZE}:fontcolor=white:` +
      `line_spacing=8:box=1:boxcolor=black@0.55:boxborderw=24:x=(w-text_w)/2:y=160[v1]`,
    `[v1]drawtext=fontfile=${FONT}:textfile=${bottomFile}:fontsize=${FONT_SIZE}:fontcolor=white:` +
      `line_spacing=8:box=1:boxcolor=black@0.55:boxborderw=24:x=(w-text_w)/2:y=h-360[vout]`,
  ];
  const filterFile = path.join(workDir, 'filter.txt');
  fs.writeFileSync(filterFile, filterLines.join(';\n'));

  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync('ffmpeg', [
    '-y', '-i', rawPng,
    '-filter_complex_script', filterFile,
    '-map', '[vout]',
    '-frames:v', '1',
    '-update', '1',
    out,
  ], { stdio: 'inherit' });

  fs.rmSync(workDir, { recursive: true, force: true });
  return out;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  buildThumbnail(args)
    .then((out) => console.log(`Thumbnail: ${out}`))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { buildThumbnail };
