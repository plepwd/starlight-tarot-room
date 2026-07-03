#!/usr/bin/env node
// One-time setup: generates YOUTUBE_REFRESH_TOKEN for .env.
// Usage: node youtube-auth.js
// → 브라우저에서 URL 열어 구글 로그인 → 콘솔에 refresh token 출력
const http = require('http');
const { google } = require('googleapis');
require('dotenv').config();

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];
const PORT = 53682;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  REDIRECT,
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
});

console.log('아래 URL을 브라우저에서 열어 구글 계정으로 로그인하세요:');
console.log(authUrl);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get('code');
  if (!code) { res.writeHead(400); res.end('code 파라미터가 없습니다.'); return; }
  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>인증 완료! 이 창은 닫아도 됩니다.</h1>');
    console.log('\n.env에 아래 값을 추가하세요:\n');
    console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
  } catch (e) {
    res.writeHead(500); res.end('오류 발생');
    console.error('토큰 교환 실패:', e);
  }
  server.close();
});

server.listen(PORT, () => console.log(`\n로컬 인증 서버 대기 중 (포트 ${PORT})...`));
