import { pickQuestion } from "./steps/1-pick-question.js";
import { recordVideo } from "./steps/2-record-video.js";
import { editVideo } from "./steps/3-edit-video.js";
import { uploadVideo } from "./steps/4-upload-youtube.js";

async function main() {
  console.log("1/4 질문 선정 중...");
  const question = await pickQuestion();
  console.log("질문:", question.question, "| BGM 장르:", question.bgmGenre);

  console.log("2/4 화면 녹화 중...");
  const recording = await recordVideo();
  console.log("녹화 완료:", recording.videoPath);

  console.log("3/4 영상 편집 중...");
  const edit = await editVideo();
  console.log("편집 완료:", edit.outputPath);

  console.log("4/4 유튜브 업로드 중...");
  const upload = await uploadVideo();
  console.log(`업로드 완료. videoId=${upload.videoId}, 공개 예약 시각=${upload.publishAt}`);
}

main().catch((err) => {
  console.error("파이프라인 실패:", err);
  process.exit(1);
});
