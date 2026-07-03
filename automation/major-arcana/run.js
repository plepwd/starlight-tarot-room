#!/usr/bin/env node
// Orchestrates the full pipeline for one card+question combo: record the draw,
// composite the final short, and generate the thumbnail + YouTube metadata.
// BGM and the actual upload stay manual (per the handover doc).
const path = require('path');
const { recordOnce } = require('./record');
const { editOnce } = require('./edit');
const { buildThumbnail } = require('./thumbnail');
const { buildMeta } = require('./meta');
const { uploadVideo } = require('./upload');
const { normalizeCardName } = require('./lib/cardMeanings');
require('dotenv').config();

function slugFor(card) {
  return normalizeCardName(card).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function parseArgs(argv) {
  const args = { question: '', dir: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--card') args.card = argv[++i];
    else if (a === '--question') args.question = argv[++i];
    else if (a === '--outRoot') args.outRoot = argv[++i];
    else if (a === '--dir') args.dir = true;
    else if (a === '--seed-success') args.seed = 'success';
    else if (a === '--seed-fail') args.seed = 'fail';
    else if (a === '--upload') args.upload = true;
    else if (a === '--publish-delay-hours') args.publishDelayHours = Number(argv[++i]);
  }
  if (!args.card) throw new Error('Usage: run.js --card "THE LOVERS" --question "Are we meant to be?" [--outRoot <dir>] [--dir] [--seed-success|--seed-fail] [--upload] [--publish-delay-hours 24]');
  if (!args.outRoot) args.outRoot = path.resolve(__dirname, 'output');
  return args;
}

async function runOnce({ card, question, outRoot, keepDir, seed, upload, publishDelayHours }) {
  const outDir = path.join(outRoot, slugFor(card));

  const metadata = await recordOnce({ card, question, outDir, keepDir, seed });
  console.log(`Recorded: success=${metadata.success} draws=${metadata.draws.map(d => d.name).join(' | ')}`);

  const finalVideo = await editOnce({ inDir: outDir, out: path.join(outDir, 'final.mp4') });
  console.log(`Edited: ${finalVideo}`);

  const thumbnail = await buildThumbnail({ card, question, out: path.join(outDir, 'thumbnail.png') });
  console.log(`Thumbnail: ${thumbnail}`);

  const meta = buildMeta({ card, question });
  require('fs').writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log(`Meta: ${path.join(outDir, 'meta.json')}`);

  let uploadResult = null;
  if (upload) {
    uploadResult = await uploadVideo({ inDir: outDir, publishDelayHours: publishDelayHours || 24 });
    console.log(`Uploaded: https://www.youtube.com/watch?v=${uploadResult.videoId}`);
  }

  return { outDir, metadata, finalVideo, thumbnail, meta, uploadResult };
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  runOnce({ card: args.card, question: args.question, outRoot: args.outRoot, keepDir: args.dir, seed: args.seed, upload: args.upload, publishDelayHours: args.publishDelayHours })
    .then((r) => console.log(`Done: ${r.outDir}`))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { runOnce };
