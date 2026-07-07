import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { signupOrg, login, AuthError } from "./service";

const signupSchema = z.object({
  orgName: z.string().min(2),
  branchName: z.string().min(2),
  city: z.string().min(2),
  ownerName: z.string().min(2),
  ownerPhone: z.string().min(10).max(15),
  password: z.string().min(6),
});

const loginSchema = z.object({
  phone: z.string().min(10).max(15),
  password: z.string().min(6),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/signup", async (req, reply) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const result = await signupOrg(parsed.data);
      return reply.code(201).send(result);
    } catch (err) {
      if (err instanceof AuthError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post("/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const result = await login(parsed.data.phone, parsed.data.password);
      return reply.send(result);
    } catch (err) {
      if (err instanceof AuthError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
