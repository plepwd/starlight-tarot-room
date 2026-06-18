const path = require('path');

module.exports = {
  appPath: path.resolve(__dirname, '..', '..', 'index.html'),
  // Logical CSS viewport used for the actual recording. Must stay <=600px wide
  // (the app's .app-container has max-width:600px) and exactly 9:16 so no
  // crop/letterbox is needed before the ffmpeg upscale to 1080x1920.
  viewport: { width: 540, height: 960 },
  finalSize: { width: 1080, height: 1920 },
  drawCount: 3,
  timingMs: {
    splashWaitTimeout: 5000,
    afterSplashBuffer: 200,
    afterTabSwitch: 400,
    flipReveal: 1200,
    popupHold: 1800,
    closeGap: 400,
    finalPopupHold: 7000,
  },
};
