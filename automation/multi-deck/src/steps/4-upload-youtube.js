import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { askGemini } from "../utils/gemini.js";
import { getYoutubeClient } from "../utils/youtube.js";
import { config } from "../utils/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EDIT_META_PATH = path.join(__dirname, "../../data/edit-meta.json");
const UPLOAD_META_PATH = path.join(__dirname, "../../data/upload-meta.json");

async function loadEditMeta() {
  const raw = await fs.readFile(EDIT_META_PATH, "utf-8");
  return JSON.parse(raw);
}

async function generateMetadata(editMeta) {
  const cardNames = editMeta.flips.map((f) => f.cardName).join(", ");

  const raw = await askGemini({
    system:
      "너는 한국어 유튜브 쇼츠 SEO 전문가야. 타로 리딩 쇼츠 영상의 조회수를 최대화할 " +
      "제목/설명/태그를 만들어줘. 제목은 32자 이하, 궁금증과 클릭을 유발하는 어투, 이모지 1~2개 허용. " +
      "설명은 3~5줄, 마지막 줄에 사이트 주소 포함. 태그는 10~15개, 한국어/영어 혼합, 쉼표 없이 배열로. " +
      '오직 JSON으로만 답해: {"title": "...", "description": "...", "tags": ["...", "..."]}',
    prompt:
      `질문: ${editMeta.question.question}\n뽑힌 카드: ${cardNames}\n` +
      `분위기/배경음악 장르: ${editMeta.question.bgmGenre}\n사이트: ${config.siteUrl}`,
    maxTokens: 500,
  });

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Gemini 응답에서 JSON을 찾지 못함: ${raw}`);
  const parsed = JSON.parse(jsonMatch[0]);

  const genreTag = editMeta.question.bgmGenre.replace(/\s+/g, "");
  const tags = Array.from(new Set([...parsed.tags, "타로", "쇼츠", "shorts", genreTag]));

  return { title: parsed.title, description: parsed.description, tags };
}

export async function uploadVideo() {
  const editMeta = await loadEditMeta();
  if (!editMeta.outputPath) throw new Error("edit-meta.json에 outputPath가 없습니다. 3단계를 먼저 실행하세요.");

  const metadata = await generateMetadata(editMeta);

  const publishAt = new Date(
    Date.now() + config.publishDelayHours * 60 * 60 * 1000
  ).toISOString();

  const youtube = getYoutubeClient();

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        categoryId: "24", // Entertainment
      },
      status: {
        privacyStatus: "private",
        publishAt,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fsSync.createReadStream(editMeta.outputPath),
    },
  });

  const uploadMeta = {
    videoId: response.data.id,
    title: metadata.title,
    description: metadata.description,
    tags: metadata.tags,
    publishAt,
    uploadedAt: new Date().toISOString(),
  };
  await fs.writeFile(UPLOAD_META_PATH, JSON.stringify(uploadMeta, null, 2), "utf-8");
  return uploadMeta;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  uploadVideo()
    .then((meta) => {
      console.log(`업로드 완료. videoId=${meta.videoId}, 공개 예약 시각=${meta.publishAt}`);
    })
    .catch((err) => {
      console.error("업로드 실패:", err);
      process.exit(1);
    });
}
