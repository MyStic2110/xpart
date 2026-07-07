import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import {
  jobCards,
  jobCardServices,
  jobCardProducts,
  services,
  clients,
  vehicles,
  vehicleMakes,
  vehicleModels,
  invoices,
  users,
} from "@/db/schema";

export class JobCardDetailError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

export async function getJobCardDetail(orgId: string, jobCardId: string) {
  const jobCard = await db.query.jobCards.findFirst({ where: and(eq(jobCards.id, jobCardId), eq(jobCards.orgId, orgId)) });
  if (!jobCard) throw new JobCardDetailError("job card not found", 404);

  const client = await db.query.clients.findFirst({ where: eq(clients.id, jobCard.clientId) });
  const vehicle = await db.query.vehicles.findFirst({ where: eq(vehicles.id, jobCard.vehicleId) });

  const make = vehicle?.makeId ? await db.query.vehicleMakes.findFirst({ where: eq(vehicleMakes.id, vehicle.makeId) }) : null;
  const model = vehicle?.modelId ? await db.query.vehicleModels.findFirst({ where: eq(vehicleModels.id, vehicle.modelId) }) : null;

  const servicesList = await db
    .select({
      id: jobCardServices.id,
      serviceName: services.name,
      qty: jobCardServices.qty,
      price: jobCardServices.price,
    })
    .from(jobCardServices)
    .innerJoin(services, eq(services.id, jobCardServices.serviceId))
    .where(eq(jobCardServices.jobCardId, jobCardId));

  const productsList = await db
    .select({
      id: jobCardProducts.id,
      serviceName: jobCardProducts.productName,
      qty: jobCardProducts.qty,
      price: jobCardProducts.price,
    })
    .from(jobCardProducts)
    .where(eq(jobCardProducts.jobCardId, jobCardId));

  const lineItems = [
    ...servicesList.map((s) => ({ ...s, type: "service" as const })),
    ...productsList.map((p) => ({ ...p, type: "product" as const })),
  ];

  const advisor = jobCard.serviceAdvisorId
    ? await db.query.users.findFirst({ where: eq(users.id, jobCard.serviceAdvisorId) })
    : null;

  const invoice = await db.query.invoices.findFirst({ where: eq(invoices.jobCardId, jobCardId) });

  return {
    jobCard,
    client,
    vehicle: vehicle ? { ...vehicle, makeName: make?.name ?? null, modelName: model?.name ?? null } : null,
    lineItems,
    serviceAdvisorName: advisor?.name ?? null,
    invoice: invoice ?? null,
  };
}

