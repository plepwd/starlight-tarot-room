import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { config } from "../utils/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUESTION_PATH = path.join(__dirname, "../../data/current-question.json");
const RECORDINGS_DIR = path.join(__dirname, "../../output/recordings");
const META_PATH = path.join(__dirname, "../../data/recording-meta.json");

// 쇼츠 비율(9:16). Playwright의 recordVideo가 프레임 단위로 정확히 녹화해주므로
// 별도 OS 화면녹화(ffmpeg)는 쓰지 않고, 효과음/자막 합성만 3단계에서 ffmpeg로 처리한다.
const VIEWPORT = { width: 480, height: 854 };

// 고정 순서: Universal Waite -> Lenormand -> Oracle Belline
const DECK_SEQUENCE = [
  { tabId: "tab-rw", key: "rw", label: "Universal Waite" },
  { tabId: "tab-len", key: "len", label: "Lenormand" },
  { tabId: "tab-bel", key: "bel", label: "Oracle Belline" },
];

const CARDS_PER_DECK = 1;
const FLIP_ANIMATION_MS = 450;

async function loadQuestion() {
  const raw = await fs.readFile(QUESTION_PATH, "utf-8");
  return JSON.parse(raw);
}

async function flipRandomCard(page) {
  const backCards = page.locator(".card:not(.flipped)");
  const count = await backCards.count();
  if (count === 0) {
    throw new Error("뒤집을 수 있는 카드가 없습니다 (모든 카드가 이미 뒤집힘)");
  }
  const index = Math.floor(Math.random() * count);
  const target = backCards.nth(index);
  await target.click();
  await page.waitForTimeout(FLIP_ANIMATION_MS + 250);
  const cardName = await target.locator(".card-name").innerText();
  return cardName;
}

export async function recordVideo() {
  const question = await loadQuestion();
  await fs.mkdir(RECORDINGS_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: RECORDINGS_DIR, size: VIEWPORT },
  });
  const page = await context.newPage();

  const events = [];
  const recordingStart = Date.now();
  const mark = (type, extra = {}) => {
    events.push({ type, atMs: Date.now() - recordingStart, ...extra });
  };

  await page.goto(config.siteUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("#canvas", { timeout: 30000 });
  mark("site-loaded");

  await page.fill("#question-input", question.question);
  mark("question-filled", { question: question.question });
  await page.waitForTimeout(800);

  for (const deck of DECK_SEQUENCE) {
    await page.click(`#${deck.tabId}`);
    mark("deck-selected", { deck: deck.key });
    await page.waitForTimeout(500);

    for (let i = 0; i < CARDS_PER_DECK; i++) {
      const cardName = await flipRandomCard(page);
      mark("card-flip", { deck: deck.key, cardName });
    }
    await page.waitForTimeout(700);
  }

  mark("sequence-complete");
  await page.waitForTimeout(1000);

  const video = page.video();
  await context.close();
  await browser.close();

  const videoPath = video ? await video.path() : null;

  const meta = {
    question,
    viewport: VIEWPORT,
    deckSequence: DECK_SEQUENCE.map((d) => d.key),
    events,
    videoPath,
    recordedAt: new Date().toISOString(),
  };
  await fs.writeFile(META_PATH, JSON.stringify(meta, null, 2), "utf-8");
  return meta;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  recordVideo()
    .then((meta) => {
      console.log("녹화 완료:", meta.videoPath);
      console.log("이벤트 타임라인:", meta.events);
    })
    .catch((err) => {
      console.error("녹화 실패:", err);
      process.exit(1);
    });
}
