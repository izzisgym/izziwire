import { Router } from "express";
import { prisma } from "../db.js";
import { getCurrentMember } from "../linkedin/me.js";
import { createPost } from "../linkedin/posts-api.js";
import { z } from "zod";

const bodySchema = z.object({ commentary: z.string().min(1).max(3000) });

export const postsRouter = Router();

postsRouter.post("/", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
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
    const result = await createPost({
      accessToken: tokenRow.accessToken,
      authorUrn,
      commentary: parsed.data.commentary,
    });
    res.json({ id: result.id, author: me.id });
  } catch (e) {
    console.error("Create post error", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Publish failed" });
  }
});
