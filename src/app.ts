import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { env } from "@/env";
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
import { webhookRoutes } from "@/modules/webhooks/routes";

export async function buildApp() {
  const app = Fastify({ logger: true });
  
  let corsOrigin: any = true;
  if (env.CORS_ALLOWED_ORIGINS) {
    corsOrigin = env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  } else if (process.env.NODE_ENV === "production") {
    console.warn(
      "[CORS] WARNING: CORS_ALLOWED_ORIGINS is not set in production. Defaulting to open wildcard access."
    );
  }

  await app.register(cors, { origin: corsOrigin });
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

  async function apiRoutes(api: any) {
    api.get("/health", async () => {
      await db.execute(sql`select 1`);
      return { status: "ok" };
    });

    await api.register(authRoutes);
    await api.register(meRoutes);
    await api.register(branchRoutes);
    await api.register(uploadRoutes);
    await api.register(staffRoutes);
    await api.register(attendanceRoutes);
    await api.register(payrollRoutes);
    await api.register(catalogRoutes);
    await api.register(clientRoutes);
    await api.register(jobCardRoutes);
    await api.register(servicesRoutes);
    await api.register(invoiceRoutes);
    await api.register(salesRoutes);
    await api.register(connectorRoutes);
    await api.register(dashboardRoutes);
    await api.register(productRoutes);
    await api.register(inventoryRoutes);
    await api.register(vendorRoutes);
    await api.register(enquiryRoutes);
    await api.register(offersRoutes);
    await api.register(notificationsRoutes);
    await api.register(reportsRoutes);
    await api.register(expenseRoutes);
    await api.register(calendarRoutes);
    await api.register(cameraRoutes);
    await api.register(diagnosticsRoutes);
    await api.register(garagesRoutes);
    await api.register(webhookRoutes);
  }

  // Register routes under /api and root /
  await app.register(apiRoutes, { prefix: "/api" });
  await app.register(apiRoutes);

  // Serve production React SPA build if available
  const frontendDist = path.resolve("frontend/dist");
  if (existsSync(frontendDist)) {
    await app.register(fastifyStatic, {
      root: frontendDist,
      prefix: "/",
      decorateReply: false,
    });

    app.setNotFoundHandler((req, reply) => {
      const url = req.raw.url || "";
      if (url.startsWith("/api") || url.startsWith("/uploads") || url.startsWith("/documentation")) {
        reply.status(404).send({ error: "Not found" });
      } else {
        reply.sendFile("index.html", frontendDist);
      }
    });
  }

  return app;
}
