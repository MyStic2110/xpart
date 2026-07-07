import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { branches, organizations } from "@/db/schema";
import { requireAuth, requireRole } from "@/middleware/auth";

const createBranchSchema = z.object({
  name: z.string().min(2),
  salonName: z.string().min(2),
  city: z.string().min(2),
  address: z.string().optional(),
  // logoUrl holds an uploaded path like "/uploads/x.png"; website is often
  // scheme-less ("www.xpart.info") — so keep these lenient, not strict URLs.
  logoUrl: z.string().optional().or(z.literal("")),
  phone: z.string().min(10).max(15).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().optional().or(z.literal("")),
  gstNumber: z.string().optional().or(z.literal("")),
  workingHours: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]).default("active"),
  // Loyalty config (per branch)
  loyaltyPointsEnabled: z.boolean().optional(),
  pointsPerThousand: z.coerce.number().int().min(0).optional(),
  redeemPaisePerPoint: z.coerce.number().int().min(1).optional(),
  // Business profile / System Settings (per branch)
  facebookUrl: z.string().optional().or(z.literal("")),
  instagramUrl: z.string().optional().or(z.literal("")),
  youtubeUrl: z.string().optional().or(z.literal("")),
  googleMapsUrl: z.string().optional().or(z.literal("")),
  loginBgUrl: z.string().optional().or(z.literal("")),
  openingTime: z.string().optional().or(z.literal("")),
  closingTime: z.string().optional().or(z.literal("")),
  dayEndReportTime: z.string().optional().or(z.literal("")),
  extraHoursEnabled: z.boolean().optional(),
  workingDays: z
    .array(z.object({ day: z.string(), open: z.string(), close: z.string(), closed: z.boolean() }))
    .optional(),
});

const updateBranchSchema = createBranchSchema.partial();

// Only org_owner can manage branches for now; super_admin is platform-level
// and would be granted via a separate cross-org mechanism, not staff_assignments.
const canManageBranches = [requireAuth, requireRole("org_owner")];

export async function branchRoutes(app: FastifyInstance) {
  app.get("/branches", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const rows = await db.select().from(branches).where(eq(branches.orgId, auth.orgId));
    return reply.send(rows);
  });

  app.post("/branches", { preHandler: canManageBranches }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = createBranchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const data = parsed.data;
    const [branch] = await db
      .insert(branches)
      .values({
        orgId: auth.orgId,
        name: data.name,
        salonName: data.salonName,
        city: data.city,
        address: data.address || null,
        logoUrl: data.logoUrl || null,
        phone: data.phone || null,
        email: data.email || null,
        website: data.website || null,
        gstNumber: data.gstNumber || null,
        workingHours: data.workingHours || null,
        status: data.status,
        ...(data.loyaltyPointsEnabled !== undefined ? { loyaltyPointsEnabled: data.loyaltyPointsEnabled } : {}),
        ...(data.pointsPerThousand !== undefined ? { pointsPerThousand: data.pointsPerThousand } : {}),
        ...(data.redeemPaisePerPoint !== undefined ? { redeemPaisePerPoint: data.redeemPaisePerPoint } : {}),
      })
      .returning();

    return reply.code(201).send(branch);
  });

  app.patch("/branches/:id", { preHandler: canManageBranches }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    const parsed = updateBranchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const data = parsed.data;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      updates[key] = value === "" ? null : value;
    }
    if (Object.keys(updates).length === 0) return reply.code(400).send({ error: "no fields to update" });

    const [updated] = await db
      .update(branches)
      .set(updates)
      .where(and(eq(branches.id, id), eq(branches.orgId, auth.orgId)))
      .returning();

    if (!updated) return reply.code(404).send({ error: "branch not found" });
    return reply.send(updated);
  });

  // Org-wide settings. `walletEnabled` is the master switch for the whole
  // wallet/loyalty concept — when off, no branch earns or redeems points.
  // (Owner-controlled for now; a platform super_admin would own this later.)
  const orgSettingsSchema = z.object({ walletEnabled: z.boolean() });

  app.patch("/org/settings", { preHandler: canManageBranches }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = orgSettingsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const [updated] = await db
      .update(organizations)
      .set({ walletEnabled: parsed.data.walletEnabled })
      .where(eq(organizations.id, auth.orgId))
      .returning();

    return reply.send({ walletEnabled: updated.walletEnabled });
  });
}
