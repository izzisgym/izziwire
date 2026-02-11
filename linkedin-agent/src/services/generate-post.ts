import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import type { Topic } from "@prisma/client";

export async function generatePostFromTopic(topic: Topic): Promise<string | null> {
  if (!config.anthropic.apiKey) return null;

  const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
  const prompt = `Generate a single LinkedIn post (organic, professional tone). 
Topic: ${topic.name}${topic.keywords ? ` Keywords: ${topic.keywords}` : ""}
Requirements: hook in first line, 1-2 short paragraphs, optional soft CTA at the end. No hashtag spam. Output only the post text, no preamble.`;

  const msg = await anthropic.messages.create({
    model: config.anthropic.defaultModel,
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const block = msg.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text.trim() : null;
}
