import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import Anthropic from "@anthropic-ai/sdk";

const bodySchema = z.object({
  postText: z.string().min(1).optional(),
  postUrl: z.string().url().optional(),
}).refine((d) => d.postText ?? d.postUrl, { message: "Provide postText or postUrl" });

export const commentRouter = Router();

commentRouter.post("/suggest", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }

  if (!config.anthropic.apiKey) {
    res.status(503).json({ error: "AI not configured (ANTHROPIC_API_KEY)" });
    return;
  }

  const text = parsed.data.postText ?? `Post at URL: ${parsed.data.postUrl}. (User will paste the post content if needed.)`;
  const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

  try {
    const msg = await anthropic.messages.create({
      model: config.anthropic.defaultModel,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `You are a professional LinkedIn comment assistant. Given the following LinkedIn post (or its URL/context), write a short, genuine, professional comment (2-4 sentences) that adds value—e.g. insight, question, or appreciation. Do not be generic or salesy. Output only the comment text, no preamble.\n\nPost:\n${text}`,
        },
      ],
    });

    const block = msg.content.find((b) => b.type === "text");
    const suggestedComment = block && block.type === "text" ? block.text.trim() : "";
    res.json({ suggestedComment });
  } catch (e) {
    console.error("Comment suggest error", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Suggestion failed" });
  }
});
