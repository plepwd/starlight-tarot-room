const { drawReaction, resultCaption, buildCTA } = require('./captions');

function evt(events, type, drawIndex) {
  return events.find(e => e.type === type && (drawIndex === undefined || e.drawIndex === drawIndex));
}

/**
 * Turns record.js's metadata.json into a flat list of caption boxes
 * ({ text, startSec, endSec, y }) and SFX tick timestamps (seconds).
 */
function buildPlan(metadata) {
  const { events, draws, success, card } = metadata;
  const total = draws.length;
  const tabSwitch = evt(events, 'tab_switch').t;
  const lastDraw = draws[draws.length - 1];

  const captions = [];
  const ticks = [];

  // Opening hook, shown over the app's own splash animation. The two lines run
  // concurrently, so they need enough vertical gap to clear each other even
  // when the tagline wraps to two lines.
  captions.push({ text: 'Starlight Tarot Challenge', startSec: 0, endSec: tabSwitch / 1000, y: 'h-540' });
  captions.push({ text: 'if THIS card appears...\nit\'s a sign', startSec: 0, endSec: tabSwitch / 1000, y: 'h-360' });

  draws.forEach((d, i) => {
    const tapFlip = evt(events, 'tap_flip', i).t;
    const tapPopup = evt(events, 'tap_popup', i).t;
    const holdEnd = evt(events, 'popup_hold_end', i).t;
    ticks.push(tapFlip / 1000);

    const reaction = drawReaction({ drawIndex: i, total, isMatch: d.isMatch, overallSuccess: success });
    captions.push({ text: reaction, startSec: tapFlip / 1000, endSec: tapPopup / 1000, y: 'h-380' });

    const isLast = i === total - 1;
    if (isLast) {
      const resultText = resultCaption({ success, targetCard: card, lastDrawnCard: lastDraw.name });
      const cta = buildCTA({ success });
      const resultStart = tapPopup / 1000 + 0.3;
      const resultEnd = tapPopup / 1000 + 3.5;
      captions.push({ text: resultText, startSec: resultStart, endSec: resultEnd, y: 'h-380' });

      const ctaStart = resultEnd + 0.2;
      const totalEnd = holdEnd / 1000;
      const span = Math.max(totalEnd - ctaStart, 1.5);
      const seg = span / 3;
      captions.push({ text: cta.signal, startSec: ctaStart, endSec: ctaStart + seg, y: 'h-460' });
      captions.push({ text: cta.nudge, startSec: ctaStart + seg, endSec: ctaStart + seg * 2, y: 'h-460' });
      captions.push({ text: cta.action, startSec: ctaStart + seg * 2, endSec: totalEnd, y: 'h-460' });
    }
  });

  return { captions, ticks, durationSec: metadata.durationMs / 1000 };
}

module.exports = { buildPlan };
