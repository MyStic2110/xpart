import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "@/middleware/auth";
import { createMechanic, createStaffMember, listStaff, updateMechanic, updateStaffMember, StaffError } from "./service";

const baseSchema = {
  name: z.string().min(2),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional().or(z.literal("")),
  username: z.string().min(3).optional().or(z.literal("")),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
  gender: z.enum(["male", "female"]),
  dateOfBirth: z.string().optional().or(z.literal("")),
  workingHoursStart: z.string().min(1),
  workingHoursEnd: z.string().min(1),
  monthlySalary: z.coerce.number().positive(),
  dateOfJoining: z.string().min(1),
  emergencyContactNumber: z.string().optional().or(z.literal("")),
  emergencyContactPerson: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  idProofUrl: z.string().optional().or(z.literal("")),
  photoUrl: z.string().optional().or(z.literal("")),
  branchId: z.string().uuid({ message: "branch is required" }),
};

const mechanicSchema = z
  .object({
    ...baseSchema,
    mechanicType: z.string().min(1),
    serviceCommissionPct: z.coerce.number().min(0).max(100).optional(),
    productCommissionPct: z.coerce.number().min(0).max(100).optional(),
  })
  .refine((d) => d.password === d.confirmPassword, { message: "passwords do not match", path: ["confirmPassword"] });

const staffSchema = z
  .object({
    ...baseSchema,
    userType: z.string().min(1),
    department: z.string().min(1),
  })
  .refine((d) => d.password === d.confirmPassword, { message: "passwords do not match", path: ["confirmPassword"] });

const canManageStaff = [requireAuth, requireRole("org_owner", "admin", "branch_manager")];

export async function staffRoutes(app: FastifyInstance) {
  app.get("/staff", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const rows = await listStaff(auth.orgId);
    return reply.send(rows);
  });

  app.post("/staff/mechanics", { preHandler: canManageStaff }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = mechanicSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const result = await createMechanic(auth, parsed.data);
      return reply.code(201).send(result);
    } catch (err) {
      if (err instanceof StaffError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post("/staff/members", { preHandler: canManageStaff }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = staffSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const result = await createStaffMember(auth, parsed.data);
      return reply.code(201).send(result);
    } catch (err) {
      if (err instanceof StaffError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.put("/staff/mechanics/:userId", { preHandler: canManageStaff }, async (req, reply) => {
    const auth = req.auth!;
    const { userId } = req.params as { userId: string };
    const parsed = updateMechanicSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const result = await updateMechanic(auth, userId, parsed.data);
      return reply.send(result);
    } catch (err) {
      if (err instanceof StaffError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.put("/staff/members/:userId", { preHandler: canManageStaff }, async (req, reply) => {
    const auth = req.auth!;
    const { userId } = req.params as { userId: string };
    const parsed = updateStaffSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const result = await updateStaffMember(auth, userId, parsed.data);
      return reply.send(result);
    } catch (err) {
      if (err instanceof StaffError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}

const updateBaseSchema = {
  name: z.string().min(2),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional().or(z.literal("")),
  username: z.string().min(3).optional().or(z.literal("")),
  password: z.string().min(6).optional().or(z.literal("")),
  confirmPassword: z.string().min(6).optional().or(z.literal("")),
  gender: z.enum(["male", "female"]),
  dateOfBirth: z.string().optional().or(z.literal("")),
  workingHoursStart: z.string().min(1),
  workingHoursEnd: z.string().min(1),
  monthlySalary: z.coerce.number().positive(),
  dateOfJoining: z.string().min(1),
  emergencyContactNumber: z.string().optional().or(z.literal("")),
  emergencyContactPerson: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  idProofUrl: z.string().optional().or(z.literal("")),
  photoUrl: z.string().optional().or(z.literal("")),
  branchId: z.string().uuid({ message: "branch is required" }),
};

const updateMechanicSchema = z
  .object({
    ...updateBaseSchema,
    mechanicType: z.string().min(1),
    serviceCommissionPct: z.coerce.number().min(0).max(100).optional(),
    productCommissionPct: z.coerce.number().min(0).max(100).optional(),
  })
  .refine((d) => !d.password || d.password === d.confirmPassword, {
    message: "passwords do not match",
    path: ["confirmPassword"],
  });

const updateStaffSchema = z
  .object({
    ...updateBaseSchema,
    userType: z.string().min(1),
    department: z.string().min(1),
  })
  .refine((d) => !d.password || d.password === d.confirmPassword, {
    message: "passwords do not match",
    path: ["confirmPassword"],
  });
