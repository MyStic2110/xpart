import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "@/middleware/auth";
import { createJobCard, listJobCards, JobCardError } from "./service";
import { getJobCardDetail, JobCardDetailError } from "./detail-service";

const clientSchema = z.object({
  phone: z.string().min(10).max(15),
  name: z.string().min(1),
  address: z.string().optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other", "unknown"]).optional(),
  dateOfBirth: z.string().optional().or(z.literal("")),
  anniversary: z.string().optional().or(z.literal("")),
  sourceOfClient: z.string().optional().or(z.literal("")),
});

const vehicleSchema = z.object({
  plateNumber: z.string().min(1),
  makeId: z.string().uuid().optional().or(z.literal("")),
  modelId: z.string().uuid().optional().or(z.literal("")),
  segment: z.string().optional().or(z.literal("")),
  year: z.coerce.number().optional(),
  color: z.string().optional().or(z.literal("")),
  fuelType: z.enum(["petrol", "diesel", "cng", "electric", "hybrid"]).optional(),
  odometerReading: z.coerce.number().optional(),
  nextServiceDate: z.string().optional().or(z.literal("")),
});

const createJobCardSchema = z.object({
  branchId: z.string().uuid(),
  jobDate: z.string().min(1),
  serviceAdvisorId: z.string().uuid().optional().or(z.literal("")),
  client: clientSchema,
  vehicle: vehicleSchema,
  lineItems: z.array(z.object({ serviceId: z.string().uuid(), qty: z.coerce.number().positive(), price: z.coerce.number().nonnegative() })),
  productItems: z.array(z.object({
    productId: z.string().uuid().optional().nullable(),
    productName: z.string().min(1),
    qty: z.coerce.number().positive(),
    price: z.coerce.number().nonnegative()
  })).optional(),
  discount: z.coerce.number().nonnegative().default(0),
  taxPercent: z.coerce.number().nonnegative().default(0),
  images: z.array(z.string()).optional(),
  appliedOfferId: z.string().uuid().optional().or(z.literal("")),
  enquiryId: z.string().uuid().optional().or(z.literal("")),
});

export async function jobCardRoutes(app: FastifyInstance) {
  app.get("/job-cards", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { branchId } = req.query as { branchId?: string };
    const rows = await listJobCards(auth.orgId, branchId && branchId !== "all" ? branchId : null);
    return reply.send(rows);
  });

  app.get("/job-cards/:id", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const { id } = req.params as { id: string };
    try {
      const detail = await getJobCardDetail(auth.orgId, id);
      return reply.send(detail);
    } catch (err) {
      if (err instanceof JobCardDetailError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });

  app.post("/job-cards", { preHandler: requireAuth }, async (req, reply) => {
    const auth = req.auth!;
    const parsed = createJobCardSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const result = await createJobCard(auth, {
        ...parsed.data,
        serviceAdvisorId: parsed.data.serviceAdvisorId || undefined,
        vehicle: { ...parsed.data.vehicle, makeId: parsed.data.vehicle.makeId || undefined, modelId: parsed.data.vehicle.modelId || undefined },
      });
      return reply.code(201).send(result);
    } catch (err) {
      if (err instanceof JobCardError) return reply.code(err.statusCode).send({ error: err.message });
      throw err;
    }
  });
}
