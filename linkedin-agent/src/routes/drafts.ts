import { Router } from "express";
import { prisma } from "../db.js";
import { getCurrentMember } from "../linkedin/me.js";
import { createPost } from "../linkedin/posts-api.js";
import { z } from "zod";

const createSchema = z.object({ content: z.string().min(1), topicId: z.string().optional() });

export const draftsRouter = Router();

draftsRouter.get("/", async (req, res) => {
  const list = await prisma.draft.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(list);
});

draftsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const draft = await prisma.draft.create({
    data: {
      content: parsed.data.content,
      topicId: parsed.data.topicId ?? undefined,
      status: "draft",
    },
  });
  res.json(draft);
});

draftsRouter.post("/:id/approve", async (req, res) => {
  const draft = await prisma.draft.findUnique({ where: { id: req.params.id } });
  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }
  if (draft.status !== "draft" && draft.status !== "approved") {
    res.status(400).json({ error: "Draft already published or rejected" });
    return;
  }

  const tokenRow = await prisma.linkedInToken.findFirst();
  if (!tokenRow) {
    res.status(401).json({ error: "LinkedIn not connected" });
    return;
  }

  try {
    const me = await getCurrentMember(tokenRow.accessToken);
    const authorUrn = `urn:li:person:${me.id}`;
    await createPost({
      accessToken: tokenRow.accessToken,
      authorUrn,
      commentary: draft.content,
    });
    await prisma.draft.update({
      where: { id: draft.id },
      data: { status: "published", publishedAt: new Date() },
    });
    res.json({ ok: true, draftId: draft.id });
  } catch (e) {
    console.error("Publish draft error", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Publish failed" });
  }
});

draftsRouter.patch("/:id", async (req, res) => {
  const { status } = req.body as { status?: string };
  if (status && !["draft", "approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const draft = await prisma.draft.update({
    where: { id: req.params.id },
    data: status ? { status } : {},
  });
  res.json(draft);
});
