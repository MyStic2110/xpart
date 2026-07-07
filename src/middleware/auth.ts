import type { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "@/env";

export interface AuthContext {
  userId: string;
  orgId: string;
  // branchIds: undefined/empty means org-wide scope (e.g. org_owner)
  assignments: { branchId: string | null; role: string }[];
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "missing bearer token" });
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as AuthContext;
    req.auth = payload;
  } catch {
    return reply.code(401).send({ error: "invalid or expired token" });
  }
}

// Resolves which branch ids the caller can act on for this org.
// Empty array = org-wide access (org_owner / super_admin level assignment).
export function effectiveBranchIds(auth: AuthContext): string[] {
  const orgWide = auth.assignments.some((a) => a.branchId === null);
  if (orgWide) return [];
  return auth.assignments.map((a) => a.branchId as string);
}

export function requireRole(...allowedRoles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = req.auth;
    if (!auth) return reply.code(401).send({ error: "missing bearer token" });
    const hasRole = auth.assignments.some((a) => allowedRoles.includes(a.role));
    if (!hasRole) return reply.code(403).send({ error: "insufficient permissions" });
  };
}
