const { meaningFor } = require('./cardMeanings');

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Reaction line shown right after a draw that did NOT match the target card.
const MISS_REACTIONS = [
  "ok not yet...",
  "hm, not this one",
  "still waiting...",
  "the universe is making us wait",
  "not yet...",
  "close, but no",
];

// Reaction line shown right after an EARLY match (draw 1 or 2), before the suspense pays off.
const EARLY_HIT_REACTIONS = [
  "wait—",
  "oh.",
  "did that just...",
  "hold on.",
];

// Final-draw reaction when the target card lands on the last try.
const FINAL_HIT_REACTIONS = [
  "THIS IS IT",
  "there it is.",
  "oh.",
  "no way.",
];

// Final-draw reaction when the target card never showed up.
const FINAL_MISS_REACTIONS = [
  "...",
  "not today",
  "well—",
  "guess not",
];

const ATTENTION_WORDS = ['wait', 'but', 'stop'];

const SIGNAL_LINES_SUCCESS = [
  "the universe said yes",
  "the cards agree",
  "that's your sign",
  "yes. it's right there.",
];

const SIGNAL_LINES_FAIL = [
  "the universe sent a different card",
  "not the card we expected",
  "a different sign showed up",
  "the cards had another idea",
];

const NUDGE_SUCCESS = [
  "but is your situation really this simple?",
  "is one card ever the whole story?",
  "yours probably isn't this simple, right?",
  "you know your situation has more layers than this",
  "real talk: your version of this is messier",
];

const NUDGE_FAIL = [
  "got more to your situation than a random pull can catch?",
  "this was a generic question — yours isn't",
  "imagine what it says when YOU ask it",
  "this didn't even know your side of the story",
  "a stranger's question pulled this — what would yours pull?",
  "reflect your own situation and pull again?",
];

const ACTION_LINES = [
  "pull your own — link in bio & comments",
  "go pull yours — bio + comments",
  "your turn: link in bio and comments",
  "try it yourself, link's in bio & comments",
  "draw your own — bio & comments have the link",
];

function maybeAttentionPrefix(line) {
  if (Math.random() < 0.45) {
    const w = pick(ATTENTION_WORDS);
    const cap = w.charAt(0).toUpperCase() + w.slice(1);
    return `${cap} — ${line}`;
  }
  return line;
}

/**
 * Build the per-draw reaction caption for draw index (0-based) out of `total` draws.
 * `isMatch` = whether this specific draw revealed the target card.
 * `overallSuccess` = whether the target was matched in ANY of the draws.
 */
function drawReaction({ drawIndex, total, isMatch, overallSuccess }) {
  const isLast = drawIndex === total - 1;
  if (isLast) {
    return overallSuccess ? pick(FINAL_HIT_REACTIONS) : pick(FINAL_MISS_REACTIONS);
  }
  if (isMatch) return pick(EARLY_HIT_REACTIONS);
  return pick(MISS_REACTIONS);
}

/**
 * Result/pivot caption shown right after the 3 draws, before the CTA.
 * success -> the target card's 1-line meaning.
 * failure -> pivot using whichever card actually landed on the final draw.
 */
function resultCaption({ success, targetCard, lastDrawnCard }) {
  if (success) {
    return meaningFor(targetCard);
  }
  const card = lastDrawnCard || targetCard;
  return `but ${card.toLowerCase()} showed up instead — ${meaningFor(card)}`;
}

/** Two-part CTA: [signal line, nudge line, action line]. Always re-rolled, never fixed wording. */
function buildCTA({ success }) {
  const signal = success ? pick(SIGNAL_LINES_SUCCESS) : pick(SIGNAL_LINES_FAIL);
  const nudgePool = success ? NUDGE_SUCCESS : NUDGE_FAIL;
  const nudge = maybeAttentionPrefix(pick(nudgePool));
  const action = pick(ACTION_LINES);
  return { signal, nudge, action };
}

module.exports = {
  pick,
  drawReaction,
  resultCaption,
  buildCTA,
};
