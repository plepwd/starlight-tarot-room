import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { askGemini } from "../utils/gemini.js";
import { runFfmpeg, escapeDrawtext } from "../utils/ffmpeg.js";
import { config } from "../utils/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const META_PATH = path.join(__dirname, "../../data/recording-meta.json");
const EDIT_META_PATH = path.join(__dirname, "../../data/edit-meta.json");
const FINAL_DIR = path.join(__dirname, "../../output/final");
const SFX_PATH = path.join(__dirname, "../../assets/sfx/flip.mp3");
const BGM_DIR = path.join(__dirname, "../../assets/bgm");

const CATCHPHRASE_DURATION_MS = 2500;
const CTA_DURATION_MS = 3000;
// 한글 자막용 폰트. Windows 기본값은 맑은 고딕(Malgun Gothic). 필요하면 .env의
// SUBTITLE_FONT_PATH로 다른 한글 폰트(ttf) 전체 경로를 지정.
const FONT_PATH = process.env.SUBTITLE_FONT_PATH || "C:/Windows/Fonts/malgunbd.ttf";

async function loadMeta() {
  const raw = await fs.readFile(META_PATH, "utf-8");
  return JSON.parse(raw);
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function generateCatchphrasesAndCta(meta) {
  const flips = meta.events.filter((e) => e.type === "card-flip");
  const cardList = flips.map((f) => `${f.deck}: ${f.cardName}`).join(", ");

  const raw = await askGemini({
    system:
      "You are an English-language tarot YouTube Shorts copywriter. For each card, write a punchy " +
      "one-line catchphrase that will be on screen for a couple seconds, and write one CTA " +
      "(call-to-action) line for the end of the video. " +
      "Catchphrases: short (4-8 words), emotionally charged, declarative tone. " +
      "CTA should feel like 'Pull your own card now at starlight-tarot-room.vercel.app'. " +
      'Respond with ONLY JSON: {"catchphrases": ["...", "..."], "cta": "..."}',
    prompt: `Question: ${meta.question.question}\nCards drawn in order: ${cardList}`,
    maxTokens: 400,
  });

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Could not find JSON in Gemini response: ${raw}`);
  const parsed = JSON.parse(jsonMatch[0]);

  if (!Array.isArray(parsed.catchphrases) || parsed.catchphrases.length !== flips.length) {
    throw new Error("Number of catchphrases does not match number of cards drawn");
  }
  return parsed;
}

function buildDrawtextFilters({ question, flips, catchphrases, cta, ctaStartMs, ctaEndMs }) {
  const filters = [];

  const questionEndMs = flips[0]?.atMs ?? 3000;
  filters.push(
    `drawtext=fontfile='${FONT_PATH}':text='${escapeDrawtext(question)}':` +
      "fontsize=42:fontcolor=white:box=1:boxcolor=black@0.45:boxborderw=14:" +
      "x=(w-text_w)/2:y=h*0.18:line_spacing=8:" +
      `enable='between(t,0,${(questionEndMs / 1000).toFixed(2)})'`
  );

  flips.forEach((flip, i) => {
    const startMs = flip.atMs;
    const endMs = startMs + CATCHPHRASE_DURATION_MS;
    filters.push(
      `drawtext=fontfile='${FONT_PATH}':text='${escapeDrawtext(catchphrases[i])}':` +
        "fontsize=50:fontcolor=#FFD700:box=1:boxcolor=black@0.5:boxborderw=16:" +
        "x=(w-text_w)/2:y=h*0.78:" +
        `enable='between(t,${(startMs / 1000).toFixed(2)},${(endMs / 1000).toFixed(2)})'`
    );
  });

  const ctaEnable = `enable='between(t,${(ctaStartMs / 1000).toFixed(2)},${(ctaEndMs / 1000).toFixed(2)})'`;
  filters.push(
    `drawtext=fontfile='${FONT_PATH}':text='${escapeDrawtext(cta)}':` +
      "fontsize=38:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=14:" +
      `x=(w-text_w)/2:y=(h/2-40):${ctaEnable}`
  );
  filters.push(
    `drawtext=fontfile='${FONT_PATH}':text='${escapeDrawtext(config.siteUrl)}':` +
      "fontsize=30:fontcolor=#FFD700:box=1:boxcolor=black@0.6:boxborderw=10:" +
      `x=(w-text_w)/2:y=(h/2+20):${ctaEnable}`
  );

  return filters.join(",");
}

async function pickBgmFile(genre) {
  if (!(await fileExists(BGM_DIR))) return null;
  const entries = await fs.readdir(BGM_DIR);
  const match = entries.find((name) => name.toLowerCase().includes(genre.split(" ")[0].toLowerCase()));
  return match ? path.join(BGM_DIR, match) : null;
}

export async function editVideo() {
  const meta = await loadMeta();
  if (!meta.videoPath) throw new Error("recording-meta.json에 videoPath가 없습니다. 2단계를 먼저 실행하세요.");

  const flips = meta.events.filter((e) => e.type === "card-flip");
  const sequenceCompleteEvent = meta.events.find((e) => e.type === "sequence-complete");
  const ctaStartMs = sequenceCompleteEvent ? sequenceCompleteEvent.atMs + 500 : flips.at(-1).atMs + 3000;
  const ctaEndMs = ctaStartMs + CTA_DURATION_MS;

  const { catchphrases, cta } = await generateCatchphrasesAndCta(meta);

  const hasSfx = await fileExists(SFX_PATH);
  const bgmPath = await pickBgmFile(meta.question.bgmGenre || "");

  await fs.mkdir(FINAL_DIR, { recursive: true });
  const outputPath = path.join(FINAL_DIR, `tarot-short-${Date.now()}.mp4`);

  const drawtextChain = buildDrawtextFilters({
    question: meta.question.question,
    flips,
    catchphrases,
    cta,
    ctaStartMs,
    ctaEndMs,
  });

  const args = ["-y", "-i", meta.videoPath];
  const inputs = [{ kind: "video" }];

  if (bgmPath) {
    args.push("-stream_loop", "-1", "-i", bgmPath);
    inputs.push({ kind: "bgm" });
  }
  if (hasSfx) {
    for (const flip of flips) {
      args.push("-i", SFX_PATH);
      inputs.push({ kind: "sfx", atMs: flip.atMs });
    }
  }

  const audioParts = [];
  let bgmLabel = null;
  inputs.forEach((input, idx) => {
    if (input.kind === "bgm") {
      bgmLabel = `bgm`;
      audioParts.push(`[${idx}:a]volume=0.22[${bgmLabel}]`);
    } else if (input.kind === "sfx") {
      const label = `sfx${idx}`;
      audioParts.push(`[${idx}:a]adelay=delays=${input.atMs}:all=1,volume=1.3[${label}]`);
    }
  });

  const audioLabels = inputs
    .map((input, idx) => {
      if (input.kind === "bgm") return "[bgm]";
      if (input.kind === "sfx") return `[sfx${idx}]`;
      return null;
    })
    .filter(Boolean);

  let filterComplex = `[0:v]${drawtextChain}[vout]`;
  let audioMap = null;
  if (audioLabels.length > 0) {
    filterComplex += `;${audioParts.join(";")};${audioLabels.join("")}amix=inputs=${audioLabels.length}:duration=first:dropout_transition=0[aout]`;
    audioMap = "[aout]";
  }

  args.push("-filter_complex", filterComplex);
  args.push("-map", "[vout]");
  if (audioMap) {
    args.push("-map", audioMap);
  }
  args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", outputPath);

  await runFfmpeg(args);

  const editMeta = {
    question: meta.question,
    flips: flips.map((f, i) => ({ ...f, catchphrase: catchphrases[i] })),
    cta,
    bgmUsed: bgmPath,
    sfxUsed: hasSfx ? SFX_PATH : null,
    outputPath,
    editedAt: new Date().toISOString(),
  };
  await fs.writeFile(EDIT_META_PATH, JSON.stringify(editMeta, null, 2), "utf-8");
  return editMeta;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  editVideo()
    .then((meta) => {
      console.log("편집 완료:", meta.outputPath);
    })
    .catch((err) => {
      console.error("편집 실패:", err);
      process.exit(1);
    });
}
