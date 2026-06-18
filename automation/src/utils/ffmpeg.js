import { spawn } from "node:child_process";
import { config } from "./config.js";

export function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}\n${stderr.slice(-3000)}`));
      }
    });
  });
}

export function escapeDrawtext(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "’")
    .replace(/%/g, "\\%");
}
