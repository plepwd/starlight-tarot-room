#!/usr/bin/env node
// Composites record.js's raw .webm + metadata.json into the final vertical short:
// upscales to 1080x1920, burns in the caption plan from lib/plan.js, and mixes in
// a tick SFX at every tap (flip + popup) timestamp.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildPlan } = require('./lib/plan');
const { wordWrap } = require('./lib/wrap');
const { FONT, FONT_SIZE, MAX_CHARS } = require('./lib/style');

const FINAL_SIZE = { width: 1080, height: 1920 };
const TICK_WAV = path.resolve(__dirname, 'assets', 'tick.wav');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') args.inDir = argv[++i];
    else if (a === '--out') args.out = argv[++i];
  }
  if (!args.inDir) throw new Error('Usage: edit.js --in <dir with metadata.json + .webm> [--out <final.mp4>]');
  if (!args.out) args.out = path.join(args.inDir, 'final.mp4');
  return args;
}

function findRawVideo(dir, metadata) {
  if (metadata.rawVideoPath && fs.existsSync(metadata.rawVideoPath)) return metadata.rawVideoPath;
  const webm = fs.readdirSync(dir).find(f => f.endsWith('.webm'));
  if (!webm) throw new Error(`No .webm found in ${dir}`);
  return path.join(dir, webm);
}

function editOnce({ inDir, out }) {
  const metadata = JSON.parse(fs.readFileSync(path.join(inDir, 'metadata.json'), 'utf8'));
  const rawVideo = findRawVideo(inDir, metadata);
  const plan = buildPlan(metadata);

  const workDir = path.join(inDir, '.edit');
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  // textfile= (rather than text=) sidesteps drawtext's quoting/escaping rules
  // entirely, which matters since caption copy contains apostrophes and dashes.
  const capFiles = plan.captions.map((c, i) => {
    const file = path.join(workDir, `cap_${i}.txt`);
    fs.writeFileSync(file, wordWrap(c.text, MAX_CHARS));
    return file;
  });

  const filterLines = [];
  filterLines.push(`[0:v]scale=${FINAL_SIZE.width}:${FINAL_SIZE.height}:flags=lanczos,setsar=1[v0]`);
  plan.captions.forEach((c, i) => {
    const outLabel = i === plan.captions.length - 1 ? 'vout' : `v${i + 1}`;
    filterLines.push(
      `[v${i}]drawtext=fontfile=${FONT}:textfile=${capFiles[i]}:fontsize=${FONT_SIZE}:fontcolor=white:` +
      `line_spacing=8:box=1:boxcolor=black@0.55:boxborderw=24:x=(w-text_w)/2:y=${c.y}:` +
      `enable='between(t,${c.startSec.toFixed(3)},${c.endSec.toFixed(3)})'[${outLabel}]`
    );
  });

  // Audio bed: silence trimmed to the full clip length, with a short tick blip
  // mixed in (unattenuated) at every recorded tap timestamp.
  filterLines.push(`[2:a]atrim=end=${plan.durationSec.toFixed(3)},asetpts=PTS-STARTPTS[sil]`);
  const tickLabels = plan.ticks.map((t, i) => {
    const label = `tk${i}`;
    const ms = Math.max(0, Math.round(t * 1000));
    filterLines.push(`[1:a]adelay=delays=${ms}[${label}]`);
    return `[${label}]`;
  });
  filterLines.push(`[sil]${tickLabels.join('')}amix=inputs=${tickLabels.length + 1}:duration=first:normalize=0[aout]`);

  const filterFile = path.join(workDir, 'filter.txt');
  fs.writeFileSync(filterFile, filterLines.join(';\n'));

  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync('ffmpeg', [
    '-y',
    '-i', rawVideo,
    '-i', TICK_WAV,
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=mono:sample_rate=44100',
    '-filter_complex_script', filterFile,
    '-map', '[vout]', '-map', '[aout]',
    '-t', plan.durationSec.toFixed(3),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '20',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    out,
  ], { stdio: 'inherit' });

  return out;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const out = editOnce(args);
  console.log(`Edited: ${out}`);
}

module.exports = { editOnce };
