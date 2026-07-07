import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireAuth } from "@/middleware/auth";

const UPLOAD_DIR = path.resolve("uploads");
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 5 * 1024 * 1024;

export async function uploadRoutes(app: FastifyInstance) {
  app.post("/uploads", { preHandler: requireAuth }, async (req, reply) => {
    const file = await req.file({ limits: { fileSize: MAX_BYTES } });
    if (!file) return reply.code(400).send({ error: "no file provided" });
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return reply.code(400).send({ error: "unsupported file type" });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const ext = path.extname(file.filename) || "";
    const storedName = `${randomUUID()}${ext}`;
    const buffer = await file.toBuffer();
    await writeFile(path.join(UPLOAD_DIR, storedName), buffer);

    return reply.code(201).send({ url: `/uploads/${storedName}` });
  });
}
