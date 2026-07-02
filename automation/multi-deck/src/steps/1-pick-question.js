import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { askGemini } from "../utils/gemini.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POOL_PATH = path.join(__dirname, "../../data/questions-pool.json");
const OUTPUT_PATH = path.join(__dirname, "../../data/current-question.json");

const BGM_GENRES = ["mystic ambient", "lofi chill", "dark cinematic", "dreamy piano"];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

async function pickBaseQuestion() {
  const pool = JSON.parse(await fs.readFile(POOL_PATH, "utf-8"));
  const categories = Object.keys(pool);
  const category = pickRandom(categories);
  const question = pickRandom(pool[category]);
  return { category, question };
}

async function refineQuestion({ category, question }) {
  const raw = await askGemini({
    system:
      "You are an English-language tarot/oracle YouTube Shorts planner. " +
      "Translate the given Korean question into a punchy, click-worthy one-line English subtitle " +
      "(keep the same meaning), and pick a background music genre that fits the mood. " +
      `The genre must be exactly one of: ${BGM_GENRES.join(", ")}. ` +
      'Respond with ONLY a JSON object: {"question": "...", "bgmGenre": "..."}',
    prompt: `Category: ${category}\nOriginal Korean question: ${question}`,
    maxTokens: 200,
  });

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Gemini 응답에서 JSON을 찾지 못함: ${raw}`);
  }
  return JSON.parse(jsonMatch[0]);
}

export async function pickQuestion() {
  const base = await pickBaseQuestion();
  const refined = await refineQuestion(base);

  const result = {
    category: base.category,
    baseQuestion: base.question,
    question: refined.question,
    bgmGenre: BGM_GENRES.includes(refined.bgmGenre) ? refined.bgmGenre : pickRandom(BGM_GENRES),
    createdAt: new Date().toISOString(),
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(result, null, 2), "utf-8");
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  pickQuestion()
    .then((result) => {
      console.log("질문 선정 완료:", result);
    })
    .catch((err) => {
      console.error("질문 선정 실패:", err);
      process.exit(1);
    });
}
