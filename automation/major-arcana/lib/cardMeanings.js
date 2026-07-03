// Upright 1-line meanings for all 22 Major Arcana cards (shorts-caption style).
// Keys match the English names exposed by the app's CARD_MAP (index.html), uppercase.
const MEANINGS = {
  'THE FOOL': "a fresh start, no overthinking",
  'THE MAGICIAN': "you have everything you need",
  'THE HIGH PRIESTESS': "trust your intuition",
  'THE EMPRESS': "abundance is on its way",
  'THE EMPEROR': "structure brings stability",
  'THE HIEROPHANT': "tradition has the answer here",
  'THE LOVERS': "yes, you are",
  'THE CHARIOT': "push through, you're winning",
  'STRENGTH': "you're stronger than this moment",
  'THE HERMIT': "the answer is within, alone",
  'WHEEL OF FORTUNE': "your luck is turning",
  'JUSTICE': "the truth is coming out",
  'THE HANGED MAN': "pause before you decide",
  'DEATH': "a new chapter begins",
  'TEMPERANCE': "balance is what you need",
  'THE DEVIL': "you already know what's holding you back",
  'THE TOWER': "time to let go",
  'THE STAR': "healing is coming",
  'THE MOON': "trust your gut",
  'THE SUN': "good things are finally here",
  'JUDGEMENT': "a reckoning is coming",
  'THE WORLD': "this chapter is complete",
};

// Confirmed love-themed series lineup (see handover doc). intensity is for ordering only.
const SERIES = [
  { card: 'THE LOVERS', question: 'Are we meant to be?', intensity: 'low' },
  { card: 'THE STAR', question: 'Will we get back together?', intensity: 'mid' },
  { card: 'THE FOOL', question: 'Should I give them a second chance?', intensity: 'mid' },
  { card: 'THE MOON', question: 'Is he hiding something?', intensity: 'high' },
  { card: 'THE TOWER', question: 'Is this relationship over?', intensity: 'high' },
  { card: 'DEATH', question: 'Should I move on?', intensity: 'high' },
];

// Maps the app's English card names to the Korean keys used internally by
// index.html's `decks.maj` / `state.maj` (see CARD_MAP there for the reverse direction).
const MAJOR_KO_MAP = {
  'THE FOOL': '0.바보', 'THE MAGICIAN': '1.마법사', 'THE HIGH PRIESTESS': '2.고위여사제',
  'THE EMPRESS': '3.여황제', 'THE EMPEROR': '4.황제', 'THE HIEROPHANT': '5.교황',
  'THE LOVERS': '6.연인', 'THE CHARIOT': '7.전차', 'STRENGTH': '8.힘',
  'THE HERMIT': '9.은둔자', 'WHEEL OF FORTUNE': '10.운명수레', 'JUSTICE': '11.정의',
  'THE HANGED MAN': '12.매달린', 'DEATH': '13.죽음', 'TEMPERANCE': '14.절제',
  'THE DEVIL': '15.악마', 'THE TOWER': '16.탑', 'THE STAR': '17.별',
  'THE MOON': '18.달', 'THE SUN': '19.태양', 'JUDGEMENT': '20.심판', 'THE WORLD': '21.세계',
};

function normalizeCardName(name) {
  return String(name || '').trim().toUpperCase();
}

function meaningFor(cardName) {
  const key = normalizeCardName(cardName);
  return MEANINGS[key] || "the cards are pointing somewhere new";
}

function koreanKeyFor(cardName) {
  return MAJOR_KO_MAP[normalizeCardName(cardName)];
}

module.exports = { MEANINGS, SERIES, MAJOR_KO_MAP, normalizeCardName, meaningFor, koreanKeyFor };
