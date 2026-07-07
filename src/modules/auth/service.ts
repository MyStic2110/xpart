import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { organizations, branches, users, staffAssignments } from "@/db/schema";
import { env } from "@/env";
import type { AuthContext } from "@/middleware/auth";

export class AuthError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

interface SignupInput {
  orgName: string;
  branchName: string;
  city: string;
  ownerName: string;
  ownerPhone: string;
  password: string;
}

export async function signupOrg(input: SignupInput) {
  const existing = await db.query.users.findFirst({ where: eq(users.phone, input.ownerPhone) });
  if (existing) throw new AuthError("phone already registered", 409);

  const passwordHash = await bcrypt.hash(input.password, 10);

  return await db.transaction(async (tx) => {
    const [org] = await tx.insert(organizations).values({ name: input.orgName }).returning();
    const [branch] = await tx
      .insert(branches)
      .values({ orgId: org.id, name: input.branchName, salonName: input.orgName, city: input.city })
      .returning();
    const [user] = await tx
      .insert(users)
      .values({ name: input.ownerName, phone: input.ownerPhone, passwordHash })
      .returning();
    await tx.insert(staffAssignments).values({
      userId: user.id,
      orgId: org.id,
      branchId: null, // org-wide scope for the owner
      role: "org_owner",
    });

    const token = issueToken({
      userId: user.id,
      orgId: org.id,
      assignments: [{ branchId: null, role: "org_owner" }],
    });

    return { token, org, branch, user: { id: user.id, name: user.name, phone: user.phone } };
  });
}

export async function login(phone: string, password: string) {
  const user = await db.query.users.findFirst({ where: eq(users.phone, phone) });
  if (!user || !user.passwordHash) throw new AuthError("invalid credentials", 401);

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AuthError("invalid credentials", 401);

  const assignments = await db.query.staffAssignments.findMany({
    where: eq(staffAssignments.userId, user.id),
  });
  if (assignments.length === 0) throw new AuthError("no organization access", 403);

  // single-org assumption for now: a user belongs to one org
  const orgId = assignments[0].orgId;
  const token = issueToken({
    userId: user.id,
    orgId,
    assignments: assignments.map((a) => ({ branchId: a.branchId, role: a.role })),
  });

  return { token, user: { id: user.id, name: user.name, phone: user.phone } };
}

function issueToken(payload: AuthContext) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}
