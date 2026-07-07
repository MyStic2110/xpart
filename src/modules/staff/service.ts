import bcrypt from "bcryptjs";
import { eq, and, not } from "drizzle-orm";
import { db } from "@/db/client";
import { users, staffAssignments, staffProfiles, branches } from "@/db/schema";
import type { AuthContext } from "@/middleware/auth";

export class StaffError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

interface BaseStaffInput {
  name: string;
  phone: string;
  email?: string;
  username?: string;
  password: string;
  gender: "male" | "female";
  dateOfBirth?: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  monthlySalary: number; // rupees, converted to paise here
  dateOfJoining: string;
  emergencyContactNumber?: string;
  emergencyContactPerson?: string;
  address?: string;
  idProofUrl?: string;
  photoUrl?: string;
  branchId: string;
}

interface MechanicInput extends BaseStaffInput {
  mechanicType: string;
  serviceCommissionPct?: number;
  productCommissionPct?: number;
}

interface StaffMemberInput extends BaseStaffInput {
  userType: string;
  department: string;
}

async function ensureUniquePhone(phone: string) {
  const existing = await db.query.users.findFirst({ where: eq(users.phone, phone) });
  if (existing) throw new StaffError("phone already registered", 409);
}

async function ensureUniqueUsername(username?: string) {
  if (!username) return;
  const existing = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (existing) throw new StaffError("username already taken", 409);
}

async function ensureBranchBelongsToOrg(orgId: string, branchId: string) {
  const branch = await db.query.branches.findFirst({ where: eq(branches.id, branchId) });
  if (!branch || branch.orgId !== orgId) throw new StaffError("branch not found", 404);
}

export async function createMechanic(auth: AuthContext, input: MechanicInput) {
  await ensureUniquePhone(input.phone);
  await ensureUniqueUsername(input.username);
  await ensureBranchBelongsToOrg(auth.orgId, input.branchId);
  const passwordHash = await bcrypt.hash(input.password, 10);

  return await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ name: input.name, phone: input.phone, email: input.email || null, username: input.username || null, passwordHash })
      .returning();

    await tx.insert(staffAssignments).values({
      userId: user.id,
      orgId: auth.orgId,
      branchId: input.branchId,
      role: "mechanic",
    });

    const [profile] = await tx
      .insert(staffProfiles)
      .values({
        userId: user.id,
        orgId: auth.orgId,
        category: "mechanic",
        gender: input.gender,
        dateOfBirth: input.dateOfBirth || null,
        workingHoursStart: input.workingHoursStart,
        workingHoursEnd: input.workingHoursEnd,
        monthlySalary: Math.round(input.monthlySalary * 100),
        dateOfJoining: input.dateOfJoining,
        emergencyContactNumber: input.emergencyContactNumber || null,
        emergencyContactPerson: input.emergencyContactPerson || null,
        address: input.address || null,
        idProofUrl: input.idProofUrl || null,
        photoUrl: input.photoUrl || null,
        mechanicType: input.mechanicType,
        serviceCommissionPct: input.serviceCommissionPct?.toString() ?? null,
        productCommissionPct: input.productCommissionPct?.toString() ?? null,
      })
      .returning();

    return { user: { id: user.id, name: user.name, phone: user.phone }, profile };
  });
}

export async function createStaffMember(auth: AuthContext, input: StaffMemberInput) {
  await ensureUniquePhone(input.phone);
  await ensureUniqueUsername(input.username);
  await ensureBranchBelongsToOrg(auth.orgId, input.branchId);
  const passwordHash = await bcrypt.hash(input.password, 10);

  const role = input.userType === "admin" ? "admin" : "frontdesk";

  return await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ name: input.name, phone: input.phone, email: input.email || null, username: input.username || null, passwordHash })
      .returning();

    await tx.insert(staffAssignments).values({
      userId: user.id,
      orgId: auth.orgId,
      branchId: input.branchId,
      role,
    });

    const [profile] = await tx
      .insert(staffProfiles)
      .values({
        userId: user.id,
        orgId: auth.orgId,
        category: "staff",
        gender: input.gender,
        dateOfBirth: input.dateOfBirth || null,
        workingHoursStart: input.workingHoursStart,
        workingHoursEnd: input.workingHoursEnd,
        monthlySalary: Math.round(input.monthlySalary * 100),
        dateOfJoining: input.dateOfJoining,
        emergencyContactNumber: input.emergencyContactNumber || null,
        emergencyContactPerson: input.emergencyContactPerson || null,
        address: input.address || null,
        idProofUrl: input.idProofUrl || null,
        photoUrl: input.photoUrl || null,
        userType: input.userType,
        department: input.department,
      })
      .returning();

    return { user: { id: user.id, name: user.name, phone: user.phone }, profile };
  });
}

export async function listStaff(orgId: string) {
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      phone: users.phone,
      email: users.email,
      username: users.username,
      profile: staffProfiles,
      branchId: staffAssignments.branchId,
      branchName: branches.name,
    })
    .from(users)
    .innerJoin(staffAssignments, eq(staffAssignments.userId, users.id))
    .leftJoin(staffProfiles, eq(staffProfiles.userId, users.id))
    .leftJoin(branches, eq(branches.id, staffAssignments.branchId))
    .where(eq(staffAssignments.orgId, orgId));
  return rows;
}

export interface UpdateMechanicInput extends Omit<MechanicInput, "password"> {
  password?: string;
}

export interface UpdateStaffMemberInput extends Omit<StaffMemberInput, "password"> {
  password?: string;
}

export async function updateMechanic(auth: AuthContext, targetUserId: string, input: UpdateMechanicInput) {
  const existingPhone = await db.query.users.findFirst({
    where: and(eq(users.phone, input.phone), not(eq(users.id, targetUserId))),
  });
  if (existingPhone) throw new StaffError("phone already registered", 409);

  if (input.username) {
    const existingUser = await db.query.users.findFirst({
      where: and(eq(users.username, input.username), not(eq(users.id, targetUserId))),
    });
    if (existingUser) throw new StaffError("username already taken", 409);
  }

  await ensureBranchBelongsToOrg(auth.orgId, input.branchId);

  return await db.transaction(async (tx) => {
    const userUpdates: any = {
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      username: input.username || null,
    };
    if (input.password) {
      userUpdates.passwordHash = await bcrypt.hash(input.password, 10);
    }
    await tx.update(users).set(userUpdates).where(eq(users.id, targetUserId));

    await tx
      .update(staffAssignments)
      .set({ branchId: input.branchId, role: "mechanic" })
      .where(and(eq(staffAssignments.userId, targetUserId), eq(staffAssignments.orgId, auth.orgId)));

    await tx
      .update(staffProfiles)
      .set({
        gender: input.gender,
        dateOfBirth: input.dateOfBirth || null,
        workingHoursStart: input.workingHoursStart,
        workingHoursEnd: input.workingHoursEnd,
        monthlySalary: Math.round(input.monthlySalary * 100),
        dateOfJoining: input.dateOfJoining,
        emergencyContactNumber: input.emergencyContactNumber || null,
        emergencyContactPerson: input.emergencyContactPerson || null,
        address: input.address || null,
        idProofUrl: input.idProofUrl || null,
        photoUrl: input.photoUrl || null,
        mechanicType: input.mechanicType,
        serviceCommissionPct: input.serviceCommissionPct?.toString() ?? null,
        productCommissionPct: input.productCommissionPct?.toString() ?? null,
      })
      .where(and(eq(staffProfiles.userId, targetUserId), eq(staffProfiles.orgId, auth.orgId)));

    return { success: true };
  });
}

export async function updateStaffMember(auth: AuthContext, targetUserId: string, input: UpdateStaffMemberInput) {
  const existingPhone = await db.query.users.findFirst({
    where: and(eq(users.phone, input.phone), not(eq(users.id, targetUserId))),
  });
  if (existingPhone) throw new StaffError("phone already registered", 409);

  if (input.username) {
    const existingUser = await db.query.users.findFirst({
      where: and(eq(users.username, input.username), not(eq(users.id, targetUserId))),
    });
    if (existingUser) throw new StaffError("username already taken", 409);
  }

  await ensureBranchBelongsToOrg(auth.orgId, input.branchId);
  const role = input.userType === "admin" ? "admin" : "frontdesk";

  return await db.transaction(async (tx) => {
    const userUpdates: any = {
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      username: input.username || null,
    };
    if (input.password) {
      userUpdates.passwordHash = await bcrypt.hash(input.password, 10);
    }
    await tx.update(users).set(userUpdates).where(eq(users.id, targetUserId));

    await tx
      .update(staffAssignments)
      .set({ branchId: input.branchId, role })
      .where(and(eq(staffAssignments.userId, targetUserId), eq(staffAssignments.orgId, auth.orgId)));

    await tx
      .update(staffProfiles)
      .set({
        gender: input.gender,
        dateOfBirth: input.dateOfBirth || null,
        workingHoursStart: input.workingHoursStart,
        workingHoursEnd: input.workingHoursEnd,
        monthlySalary: Math.round(input.monthlySalary * 100),
        dateOfJoining: input.dateOfJoining,
        emergencyContactNumber: input.emergencyContactNumber || null,
        emergencyContactPerson: input.emergencyContactPerson || null,
        address: input.address || null,
        idProofUrl: input.idProofUrl || null,
        photoUrl: input.photoUrl || null,
        userType: input.userType,
        department: input.department,
      })
      .where(and(eq(staffProfiles.userId, targetUserId), eq(staffProfiles.orgId, auth.orgId)));

    return { success: true };
  });
}
