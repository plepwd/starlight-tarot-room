// Wraps each manual line independently, so an explicit '\n' in the input is
// always a hard break and never gets merged into the greedy-wrap accounting
// of the line before or after it.
function wordWrap(text, maxChars) {
  return text.split('\n').map(paragraph => wrapParagraph(paragraph, maxChars)).join('\n');
}

function wrapParagraph(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

module.exports = { wordWrap };
