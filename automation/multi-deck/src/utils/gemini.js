import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "./config.js";

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

export async function askGemini({ system, prompt, maxTokens = 500 }) {
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    systemInstruction: system,
    generationConfig: { maxOutputTokens: maxTokens },
  });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
