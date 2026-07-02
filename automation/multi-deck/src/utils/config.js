import "dotenv/config";

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  return value;
}

export const config = {
  geminiApiKey: required("GEMINI_API_KEY"),
  siteUrl: required("SITE_URL", "https://starlight-tarot-room.vercel.app"),
  ffmpegPath: required("FFMPEG_PATH", "ffmpeg"),
  targetRegion: required("TARGET_REGION", "KR"),
  publishDelayHours: Number(required("PUBLISH_DELAY_HOURS", "24")),
  youtube: {
    apiKey: required("YOUTUBE_API_KEY"),
    clientId: required("YOUTUBE_CLIENT_ID"),
    clientSecret: required("YOUTUBE_CLIENT_SECRET"),
    redirectUri: required("YOUTUBE_REDIRECT_URI"),
    refreshToken: required("YOUTUBE_REFRESH_TOKEN"),
  },
};
