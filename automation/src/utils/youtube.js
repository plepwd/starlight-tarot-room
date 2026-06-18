import { google } from "googleapis";
import { config } from "./config.js";

export function getOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    config.youtube.clientId,
    config.youtube.clientSecret,
    config.youtube.redirectUri
  );
  oauth2Client.setCredentials({ refresh_token: config.youtube.refreshToken });
  return oauth2Client;
}

export function getYoutubeClient() {
  return google.youtube({ version: "v3", auth: getOAuthClient() });
}
