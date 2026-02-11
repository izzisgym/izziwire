import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import session from "express-session";
import { config } from "./config.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { authRouter } from "./routes/auth.js";
import { postsRouter } from "./routes/posts.js";
import { topicsRouter } from "./routes/topics.js";
import { draftsRouter } from "./routes/drafts.js";
import { cronRouter } from "./routes/cron.js";
import { commentRouter } from "./routes/comment.js";

const app = express();

// Trust proxy so redirect_uri and cookies work when hosted behind HTTPS
app.set("trust proxy", 1);

app.use(express.json());
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

app.get("/health", (req, res) => res.status(200).send("ok"));

app.use("/auth", authRouter);
app.use("/api/posts", postsRouter);
app.use("/api/topics", topicsRouter);
app.use("/api/drafts", draftsRouter);
app.use("/api/comment", commentRouter);
app.use("/cron", cronRouter);

app.get("/api/status", async (req, res) => {
  const { prisma } = await import("./db.js");
  const token = await prisma.linkedInToken.findFirst();
  res.json({ linkedInConnected: !!token });
});

app.use(express.static(path.join(__dirname, "..", "public")));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/auth") || req.path.startsWith("/cron")) return next();
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const port = config.port;
app.listen(port, "0.0.0.0", () => {
  console.log(`LinkedIn agent listening on port ${port}`);
});
