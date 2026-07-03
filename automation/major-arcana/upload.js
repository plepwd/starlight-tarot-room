#!/usr/bin/env node
// Uploads output/<slug>/final.mp4 to YouTube as a private scheduled Short.
// Reads credentials from .env (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN).
// Run youtube-auth.js once first to get YOUTUBE_REFRESH_TOKEN.
// Usage: node upload.js --in output/thelovers [--publish-delay-hours 24]
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();

function getYouTube() {
  const auth = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    'http://localhost:53682/oauth2callback',
  );
  auth.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
  return google.youtube({ version: 'v3', auth });
}

async function uploadVideo({ inDir, publishDelayHours = 24 }) {
  const metaPath = path.join(inDir, 'meta.json');
  const videoPath = path.join(inDir, 'final.mp4');
  const thumbPath = path.join(inDir, 'thumbnail.png');

  if (!fs.existsSync(videoPath)) throw new Error(`final.mp4 없음: ${videoPath}`);
  if (!fs.existsSync(metaPath)) throw new Error(`meta.json 없음: ${metaPath}`);
  if (!process.env.YOUTUBE_REFRESH_TOKEN) {
    throw new Error('YOUTUBE_REFRESH_TOKEN이 .env에 없습니다. youtube-auth.js를 먼저 실행하세요.');
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  const youtube = getYouTube();
  const publishAt = new Date(Date.now() + publishDelayHours * 60 * 60 * 1000).toISOString();

  console.log(`업로드 중: ${videoPath}`);
  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: meta.title,
        description: meta.description,
        tags: meta.hashtags.map(h => h.replace(/^#/, '')),
        categoryId: '24', // Entertainment
      },
      status: {
        privacyStatus: 'private',
        publishAt,
        selfDeclaredMadeForKids: false,
      },
    },
    media: { body: fs.createReadStream(videoPath) },
  });

  const videoId = res.data.id;
  console.log(`업로드 완료: https://www.youtube.com/watch?v=${videoId}`);
  console.log(`공개 예약: ${publishAt}`);

  if (fs.existsSync(thumbPath)) {
    await youtube.thumbnails.set({
      videoId,
      media: { mimeType: 'image/png', body: fs.createReadStream(thumbPath) },
    });
    console.log('썸네일 설정 완료');
  }

  const result = { videoId, publishAt, uploadedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(inDir, 'upload.json'), JSON.stringify(result, null, 2));
  return result;
}

function parseArgs(argv) {
  const args = { publishDelayHours: 24 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') args.inDir = argv[++i];
    else if (a === '--publish-delay-hours') args.publishDelayHours = Number(argv[++i]);
  }
  if (!args.inDir) throw new Error('Usage: upload.js --in <outDir> [--publish-delay-hours 24]');
  return args;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  uploadVideo(args)
    .then(r => console.log(`Done: ${JSON.stringify(r)}`))
    .catch(e => { console.error(e); process.exit(1); });
}

module.exports = { uploadVideo };
