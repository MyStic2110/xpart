import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { signupOrg, login, AuthError } from "./service";
import { schemaDoc } from "@/utils/swagger";
import { db } from "@/db/client";
import { branches } from "@/db/schema";
import { or, isNotNull } from "drizzle-orm";

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
  app.post("/auth/signup", {
    ...schemaDoc({
      tags: ["Auth"],
      summary: "Register new organization, branch, and owner account",
      body: signupSchema,
    })
  }, async (req, reply) => {
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

  app.post("/auth/login", {
    ...schemaDoc({
      tags: ["Auth"],
      summary: "Login credentials auth, returns token and roles info",
      body: loginSchema,
    })
  }, async (req, reply) => {
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

  app.get("/auth/branding", {
    ...schemaDoc({
      tags: ["Auth"],
      summary: "Get public organization and branch branding for login and portal screens",
    })
  }, async (_req, reply) => {
    // 1. Try to find a branch with custom logo or background
    const [custom] = await db
      .select({
        name: branches.name,
        salonName: branches.salonName,
        logoUrl: branches.logoUrl,
        loginBgUrl: branches.loginBgUrl,
      })
      .from(branches)
      .where(or(isNotNull(branches.logoUrl), isNotNull(branches.loginBgUrl)))
      .limit(1);

    if (custom) return reply.send(custom);

    // 2. Fallback to first branch
    const [first] = await db
      .select({
        name: branches.name,
        salonName: branches.salonName,
        logoUrl: branches.logoUrl,
        loginBgUrl: branches.loginBgUrl,
      })
      .from(branches)
      .limit(1);

    return reply.send(first ?? { name: "Xpart Automotive", salonName: null, logoUrl: null, loginBgUrl: null });
  });
}
