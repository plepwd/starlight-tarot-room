#!/usr/bin/env node
// Generates YouTube title/description/hashtags text for a card+question combo.
// Deliberately independent of the recorded outcome (success/fail) so metadata
// can be written before recording, and never spoils whether the draw hit.
const fs = require('fs');
const path = require('path');
const { normalizeCardName } = require('./lib/cardMeanings');

function titleCase(card) {
  return card.toLowerCase().split(' ')
    .map(w => (w === 'of' ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function slugFor(card) {
  return normalizeCardName(card).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function buildMeta({ card, question }) {
  const target = normalizeCardName(card);
  const display = titleCase(target);
  const slug = slugFor(target);

  const title = `If ${display} Shows Up... That's Your Sign`;

  const description = [
    `I asked the cards: "${question}"`,
    ``,
    `If ${display} shows up, that's the universe's answer.`,
    ``,
    `Want your own answer instead of mine? Draw your own card — link in bio, also dropped in the comments.`,
    ``,
    `#tarot #tarotreading #shorts #love #signs #${slug}`,
  ].join('\n');

  const hashtags = ['#tarot', '#tarotreading', '#shorts', '#love', '#signs', `#${slug}`];

  return { title, description, hashtags };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--card') args.card = argv[++i];
    else if (a === '--question') args.question = argv[++i];
    else if (a === '--out') args.out = argv[++i];
  }
  if (!args.card) throw new Error('Usage: meta.js --card "THE LOVERS" --question "Are we meant to be?" [--out <meta.json>]');
  return args;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const meta = buildMeta(args);
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(meta, null, 2));
    console.log(`Meta: ${args.out}`);
  } else {
    console.log(JSON.stringify(meta, null, 2));
  }
}

module.exports = { buildMeta };
