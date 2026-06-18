import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";

export const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

export async function askClaude({ system, prompt, maxTokens = 500 }) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
