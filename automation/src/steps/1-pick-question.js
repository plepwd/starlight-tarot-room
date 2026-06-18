import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { askClaude } from "../utils/anthropic.js";

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
  const raw = await askClaude({
    system:
      "너는 한국어 타로/오라클 유튜브 쇼츠 기획자야. 주어진 질문을 거의 같은 의미로 유지하면서 " +
      "더 끌리는 1줄 문구로 다듬고, 분위기에 맞는 배경음악 장르를 골라줘. " +
      `배경음악 장르는 반드시 다음 중 하나여야 해: ${BGM_GENRES.join(", ")}. ` +
      '오직 JSON 객체 하나만 출력해: {"question": "...", "bgmGenre": "..."}',
    prompt: `카테고리: ${category}\n원본 질문: ${question}`,
    maxTokens: 200,
  });

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Claude 응답에서 JSON을 찾지 못함: ${raw}`);
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
