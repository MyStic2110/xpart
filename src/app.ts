import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { authRoutes } from "@/modules/auth/routes";
import { meRoutes } from "@/modules/me/routes";
import { branchRoutes } from "@/modules/branches/routes";
import { uploadRoutes } from "@/modules/uploads/routes";
import { staffRoutes } from "@/modules/staff/routes";
import { attendanceRoutes } from "@/modules/attendance/routes";
import { payrollRoutes } from "@/modules/payroll/routes";
import { catalogRoutes } from "@/modules/catalog/routes";
import { clientRoutes } from "@/modules/clients/routes";
import { jobCardRoutes } from "@/modules/jobcards/routes";
import { servicesRoutes } from "@/modules/services/routes";
import { invoiceRoutes } from "@/modules/invoices/routes";
import { salesRoutes } from "@/modules/sales/routes";
import { connectorRoutes } from "@/modules/connectors/routes";
import { dashboardRoutes } from "@/modules/dashboard/routes";
import { productRoutes } from "@/modules/products/routes";
import { inventoryRoutes } from "@/modules/inventory/routes";
import { vendorRoutes } from "@/modules/vendors/routes";
import { enquiryRoutes } from "@/modules/enquiry/routes";
import { offersRoutes } from "@/modules/offers/routes";
import { notificationsRoutes } from "@/modules/notifications/routes";
import { reportsRoutes } from "@/modules/reports/routes";
import { expenseRoutes } from "@/modules/expenses/routes";
import { calendarRoutes } from "@/modules/calendar/routes";
import { cameraRoutes } from "@/modules/cameras/routes";
import { diagnosticsRoutes } from "@/modules/diagnostics/routes";
import { garagesRoutes } from "@/modules/garages/routes";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(multipart);
  mkdirSync(path.resolve("uploads"), { recursive: true });
  await app.register(fastifyStatic, {
    root: path.resolve("uploads"),
    prefix: "/uploads/",
  });

  // Register Swagger
  await app.register(swagger, {
    openapi: {
      info: {
        title: "XPart Garage SaaS API",
        description: "API Documentation for XPart Garage SaaS platform",
        version: "0.1.0",
      },
      servers: [
        {
          url: "http://localhost:3000",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  // Register Swagger UI
  await app.register(swaggerUi, {
    routePrefix: "/documentation",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
  });

  app.get("/health", async () => {
    await db.execute(sql`select 1`);
    return { status: "ok" };
  });

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(branchRoutes);
  await app.register(uploadRoutes);
  await app.register(staffRoutes);
  await app.register(attendanceRoutes);
  await app.register(payrollRoutes);
  await app.register(catalogRoutes);
  await app.register(clientRoutes);
  await app.register(jobCardRoutes);
  await app.register(servicesRoutes);
  await app.register(invoiceRoutes);
  await app.register(salesRoutes);
  await app.register(connectorRoutes);
  await app.register(dashboardRoutes);
  await app.register(productRoutes);
  await app.register(inventoryRoutes);
  await app.register(vendorRoutes);
  await app.register(enquiryRoutes);
  await app.register(offersRoutes);
  await app.register(notificationsRoutes);
  await app.register(reportsRoutes);
  await app.register(expenseRoutes);
  await app.register(calendarRoutes);
  await app.register(cameraRoutes);
  await app.register(diagnosticsRoutes);
  await app.register(garagesRoutes);

  return app;
}
