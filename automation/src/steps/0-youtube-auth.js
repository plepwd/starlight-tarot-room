import http from "node:http";
import { google } from "googleapis";
import { config } from "../utils/config.js";

// YouTube 업로드(쓰기)는 API Key만으론 안 되고 OAuth2 refresh token이 필요함.
// 이 스크립트는 최초 1회만 실행해서 .env에 넣을 YOUTUBE_REFRESH_TOKEN을 발급받는 용도.
// 사용법: npm run step0:auth 실행 후 콘솔에 뜨는 URL을 브라우저로 열어 로그인/동의하면
// 자동으로 리다이렉트되어 refresh token이 콘솔에 출력됨.

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];

function parsePort(redirectUri) {
  const url = new URL(redirectUri);
  return Number(url.port) || 80;
}

async function main() {
  const oauth2Client = new google.auth.OAuth2(
    config.youtube.clientId,
    config.youtube.clientSecret,
    config.youtube.redirectUri
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  console.log("아래 URL을 브라우저로 열어서 구글 로그인 및 권한 동의를 진행하세요:");
  console.log(authUrl);

  const port = parsePort(config.youtube.redirectUri);

  await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, config.youtube.redirectUri);
        const code = url.searchParams.get("code");
        if (!code) {
          res.writeHead(400);
          res.end("code 파라미터가 없습니다.");
          return;
        }
        const { tokens } = await oauth2Client.getToken(code);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>인증 완료! 이 창은 닫아도 됩니다.</h1>");
        console.log("\n발급된 refresh token (이 값을 .env의 YOUTUBE_REFRESH_TOKEN에 넣으세요):\n");
        console.log(tokens.refresh_token);
        server.close();
        resolve();
      } catch (err) {
        res.writeHead(500);
        res.end("인증 처리 중 오류가 발생했습니다.");
        reject(err);
      }
    });
    server.listen(port, () => {
      console.log(`\n로컬 인증 콜백 서버 대기 중 (포트 ${port})...`);
    });
  });
}

main().catch((err) => {
  console.error("인증 실패:", err);
  process.exit(1);
});
