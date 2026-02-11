import { Router } from "express";
import { prisma } from "../db.js";
import { z } from "zod";

const createSchema = z.object({ name: z.string().min(1), keywords: z.string().optional() });
const updateSchema = z.object({ name: z.string().min(1).optional(), keywords: z.string().optional(), enabled: z.boolean().optional() });

export const topicsRouter = Router();

topicsRouter.get("/", async (req, res) => {
  const list = await prisma.topic.findMany({ orderBy: { createdAt: "desc" } });
  res.json(list);
});

topicsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const topic = await prisma.topic.create({
    data: { name: parsed.data.name, keywords: parsed.data.keywords ?? undefined },
  });
  res.json(topic);
});

topicsRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }
  const topic = await prisma.topic.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(topic);
});

topicsRouter.delete("/:id", async (req, res) => {
  await prisma.topic.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
