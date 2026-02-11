import { Router } from "express";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { generatePostFromTopic } from "../services/generate-post.js";

export const cronRouter = Router();

cronRouter.post("/generate-draft", async (req, res) => {
  const secret = req.headers["x-cron-secret"] ?? req.query.secret;
  if (config.cronSecret && secret !== config.cronSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const topics = await prisma.topic.findMany({ where: { enabled: true } });
  if (topics.length === 0) {
    res.json({ ok: true, message: "No topics" });
    return;
  }

  const topic = topics[Math.floor(Math.random() * topics.length)];
  try {
    const content = await generatePostFromTopic(topic);
    if (!content) {
      res.json({ ok: true, message: "No content generated" });
      return;
    }
    const draft = await prisma.draft.create({
      data: { content, topicId: topic.id, status: "draft" },
    });
    res.json({ ok: true, draftId: draft.id });
  } catch (e) {
    console.error("Cron generate-draft error", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Generation failed" });
  }
});
