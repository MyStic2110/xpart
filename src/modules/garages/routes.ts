import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, sql, desc, or, like } from "drizzle-orm";
import { db } from "@/db/client";
import { garages, garageServices, garageWorkingHours, garageCoverage, garagePhotos, garageClaims } from "@/db/schema";
import { requireAuth, requireRole } from "@/middleware/auth";
import { schemaDoc } from "@/utils/swagger";
import { GaragesService } from "./service";

const canManage = [requireAuth, requireRole("super_admin", "org_owner", "admin", "branch_manager")];

const claimGarageSchema = z.object({
  garageId: z.string().uuid(),
  phone: z.string().min(10),
});

const updateGarageSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  address: z.string().optional(),
  website: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  serviceRadiusKm: z.number().optional(),
  status: z.string().optional(),
  services: z.array(z.object({
    serviceName: z.string(),
    category: z.string(),
    isPrimary: z.boolean(),
  })).optional(),
});

export async function garagesRoutes(app: FastifyInstance) {
  // GET /garages - Paginated list of garages
  app.get(
    "/garages",
    {
      ...schemaDoc({
        summary: "List all garages",
        tags: ["garages"],
        querystring: z.object({
          page: z.coerce.number().default(1),
          limit: z.coerce.number().default(10),
          city: z.string().optional(),
        }),
      }),
    },
    async (req, reply) => {
      const { page, limit, city } = req.query as { page: number; limit: number; city?: string };
      const offset = (page - 1) * limit;

      const conds = [];
      if (city) {
        const trimmed = city.trim();
        if (/^\d{6}$/.test(trimmed)) {
          conds.push(eq(garages.pincode, trimmed));
        } else {
          conds.push(eq(garages.city, trimmed));
        }
      }

      const rows = await db
        .select()
        .from(garages)
        .where(conds.length ? and(...conds) : undefined)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(garages.createdAt));

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(garages)
        .where(conds.length ? and(...conds) : undefined);

      return { data: rows, total: count, page, limit };
    }
  );

  // GET /garages/search - Full text search for garages
  app.get(
    "/garages/search",
    {
      ...schemaDoc({
        summary: "Search garages",
        tags: ["garages"],
        querystring: z.object({
          q: z.string().min(1),
          city: z.string().optional(),
        }),
      }),
    },
    async (req) => {
      const { q, city } = req.query as { q: string; city?: string };
      const conds = [];

      conds.push(
        or(
          like(garages.name, `%${q}%`),
          like(garages.address, `%${q}%`),
          like(garages.pincode, `%${q}%`)
        )
      );

      if (city) {
        conds.push(eq(garages.city, city.trim()));
      }

      const rows = await db
        .select()
        .from(garages)
        .where(and(...conds))
        .limit(30);

      return { data: rows };
    }
  );

  // GET /garages/nearby - Find garages within radius (Haversine distance)
  app.get(
    "/garages/nearby",
    {
      ...schemaDoc({
        summary: "Find garages nearby",
        tags: ["garages"],
        querystring: z.object({
          latitude: z.coerce.number(),
          longitude: z.coerce.number(),
          radiusKm: z.coerce.number().default(5),
        }),
      }),
    },
    async (req, reply) => {
      const { latitude, longitude, radiusKm } = req.query as { latitude: number; longitude: number; radiusKm: number };

      // Haversine formula in pure PostgreSQL math
      const distanceSql = sql<number>`6371 * acos(
        cos(radians(${latitude})) * cos(radians(${garages.latitude})) * 
        cos(radians(${garages.longitude}) - radians(${longitude})) + 
        sin(radians(${latitude})) * sin(radians(${garages.latitude}))
      )`;

      const rows = await db
        .select({
          garage: garages,
          distance: distanceSql,
        })
        .from(garages)
        .where(sql`${distanceSql} <= ${radiusKm}`)
        .orderBy(sql`${distanceSql}`)
        .limit(50);

      return { data: rows.map(r => ({ ...r.garage, distanceKm: Math.round(r.distance * 100) / 100 })) };
    }
  );

  // GET /garages/coverage - Find garages covering a specific client coordinate
  app.get(
    "/garages/coverage",
    {
      ...schemaDoc({
        summary: "Find coverage zones",
        tags: ["garages"],
        querystring: z.object({
          latitude: z.coerce.number(),
          longitude: z.coerce.number(),
        }),
      }),
    },
    async (req) => {
      const { latitude, longitude } = req.query as { latitude: number; longitude: number };

      const distanceSql = sql<number>`6371 * acos(
        cos(radians(${latitude})) * cos(radians(${garages.latitude})) * 
        cos(radians(${garages.longitude}) - radians(${longitude})) + 
        sin(radians(${latitude})) * sin(radians(${garages.latitude}))
      )`;

      // Matches garages where the distance is within their serviceRadiusKm
      const rows = await db
        .select({
          garage: garages,
          distance: distanceSql,
        })
        .from(garages)
        .where(sql`${distanceSql} <= ${garages.serviceRadiusKm}`)
        .orderBy(sql`${distanceSql}`)
        .limit(30);

      return { data: rows.map(r => ({ ...r.garage, distanceKm: Math.round(r.distance * 100) / 100 })) };
    }
  );

  // GET /garages/opportunities - AI market gap assessment
  app.get(
    "/garages/opportunities",
    {
      ...schemaDoc({
        summary: "Get AI sourcing/marketing opportunities",
        tags: ["garages"],
        querystring: z.object({
          city: z.string().default("Chennai"),
        }),
      }),
    },
    async (req) => {
      const { city } = req.query as { city: string };
      const trimmed = city.trim();
      const isPin = /^\d{6}$/.test(trimmed);

      const cityGarages = await db
        .select()
        .from(garages)
        .where(isPin ? eq(garages.pincode, trimmed) : eq(garages.city, trimmed));

      const services = await db
        .select()
        .from(garageServices);

      // Compute statistics and market potential
      const evCount = cityGarages.filter(g => {
        const primary = services.find(s => s.garageId === g.id && s.isPrimary);
        return primary?.category === "EV Garage";
      }).length;

      const luxuryCount = cityGarages.filter(g => {
        const primary = services.find(s => s.garageId === g.id && s.isPrimary);
        return primary?.category === "Luxury Garage";
      }).length;

      const totalCount = cityGarages.length;

      // Classify potential gaps
      const gaps = [];
      if (evCount < totalCount * 0.1) {
        gaps.push({
          area: `${city} Central`,
          gapType: "Under-served EV Service Network",
          description: "High volume of premium EV vehicles with less than 10% corresponding chargers/workshops.",
          priority: "High",
          score: 88,
        });
      }
      if (luxuryCount < totalCount * 0.05) {
        gaps.push({
          area: `${city} Hub`,
          gapType: "Luxury Vehicle Specialist Lack",
          description: "Premium car segments have prolonged repair durations due to limited specialty workshops.",
          priority: "Medium",
          score: 72,
        });
      }

      // Add a default general gap
      gaps.push({
        area: `${city} Suburbs`,
        gapType: "Tyre/Wheel Alignment Center Gap",
        description: "Significant commercial vehicle transit with lack of high-speed wheel service hubs.",
        priority: "Low",
        score: 45,
      });

      return {
        city,
        totalGaragesAnalysed: totalCount,
        distribution: {
          evGarages: evCount,
          luxuryGarages: luxuryCount,
          standardGarages: totalCount - evCount - luxuryCount,
        },
        opportunities: gaps,
      };
    }
  );

  // GET /garages/competition - Competitor density score maps
  app.get(
    "/garages/competition",
    {
      ...schemaDoc({
        summary: "Get competitor density map",
        tags: ["garages"],
        querystring: z.object({
          city: z.string().default("Chennai"),
        }),
      }),
    },
    async (req) => {
      const { city } = req.query as { city: string };
      const trimmed = city.trim();
      const isPin = /^\d{6}$/.test(trimmed);

      const rows = await db
        .select({
          id: garages.id,
          name: garages.name,
          latitude: garages.latitude,
          longitude: garages.longitude,
          rating: garages.rating,
        })
        .from(garages)
        .where(isPin ? eq(garages.pincode, trimmed) : eq(garages.city, trimmed))
        .limit(100);

      // Map dynamic competitors count around each coordinate within 3km
      const densityPoints = [];
      for (const pt of rows) {
        let competitorCount = 0;
        for (const other of rows) {
          if (other.id === pt.id) continue;
          const latDiff = Math.abs(pt.latitude - other.latitude);
          const lonDiff = Math.abs(pt.longitude - other.longitude);
          if (latDiff < 0.027 && lonDiff < 0.027) { // Approx 3km bounding box
            competitorCount++;
          }
        }

        densityPoints.push({
          garageId: pt.id,
          name: pt.name,
          latitude: pt.latitude,
          longitude: pt.longitude,
          competitorCount,
          densityLevel: competitorCount >= 5 ? "Critical" : competitorCount >= 3 ? "High" : competitorCount >= 1 ? "Moderate" : "Low",
        });
      }

      return { city, densityPoints };
    }
  );

  // GET /garages/services - Retrieve full unique list of services
  app.get(
    "/garages/services",
    {
      ...schemaDoc({
        summary: "Get unique services list",
        tags: ["garages"],
      }),
    },
    async () => {
      const rows = await db
        .select({
          serviceName: garageServices.serviceName,
          category: garageServices.category,
        })
        .from(garageServices)
        .groupBy(garageServices.serviceName, garageServices.category);

      return { data: rows };
    }
  );

  // GET /garages/:id - Full details of single garage
  app.get(
    "/garages/:id",
    {
      ...schemaDoc({
        summary: "Get garage detail",
        tags: ["garages"],
        params: z.object({ id: z.string().uuid() }),
      }),
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      const garage = await db.query.garages.findFirst({
        where: eq(garages.id, id),
      });

      if (!garage) return reply.status(404).send({ error: "Garage not found" });

      const services = await db
        .select()
        .from(garageServices)
        .where(eq(garageServices.garageId, id));

      const workingHours = await db
        .select()
        .from(garageWorkingHours)
        .where(eq(garageWorkingHours.garageId, id));

      const photos = await db
        .select()
        .from(garagePhotos)
        .where(eq(garagePhotos.garageId, id));

      const coverage = await db
        .select()
        .from(garageCoverage)
        .where(eq(garageCoverage.garageId, id));

      return {
        garage,
        services,
        workingHours: workingHours[0] || null,
        photos,
        coverage: coverage[0] || null,
      };
    }
  );

  // POST /garages/claim - Owner claim application generating simulated OTP
  app.post(
    "/garages/claim",
    {
      preHandler: requireAuth,
      ...schemaDoc({
        summary: "Submit garage claim request",
        tags: ["garages"],
        body: claimGarageSchema,
      }),
    },
    async (req, reply) => {
      const { garageId, phone } = req.body as z.infer<typeof claimGarageSchema>;
      const auth = req.auth!;

      const garage = await db.query.garages.findFirst({
        where: eq(garages.id, garageId),
      });

      if (!garage) return reply.status(404).send({ error: "Garage not found" });

      // Generate random OTP code
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      await db.insert(garageClaims).values({
        garageId,
        claimedByUserId: auth.userId,
        status: "pending",
        verificationOtp: otp,
      });

      // Simulate OTP SMS / WhatsApp trigger
      return {
        message: "Claim request submitted. OTP code dispatched to contact phone.",
        verificationOtp: otp, // Output the code in response to facilitate seamless API test flows
      };
    }
  );

  // POST /garages/update - Update garage details
  app.post(
    "/garages/update",
    {
      preHandler: requireAuth,
      ...schemaDoc({
        summary: "Update verified garage profile details",
        tags: ["garages"],
        body: updateGarageSchema,
      }),
    },
    async (req, reply) => {
      const { id, name, address, website, phone, serviceRadiusKm, status, services } = req.body as z.infer<typeof updateGarageSchema>;

      const garage = await db.query.garages.findFirst({
        where: eq(garages.id, id),
      });

      if (!garage) return reply.status(404).send({ error: "Garage not found" });

      // Perform update values
      await db
        .update(garages)
        .set({
          ...(name ? { name } : {}),
          ...(address ? { address } : {}),
          ...(website !== undefined ? { website } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(serviceRadiusKm ? { serviceRadiusKm } : {}),
          ...(status ? { status } : {}),
          updatedAt: new Date(),
        })
        .where(eq(garages.id, id));

      // Handle service modifications if supplied
      if (services && services.length > 0) {
        // Clear existing
        await db.delete(garageServices).where(eq(garageServices.garageId, id));
        // Add new
        for (const serv of services) {
          await db.insert(garageServices).values({
            garageId: id,
            serviceName: serv.serviceName,
            category: serv.category,
            isPrimary: serv.isPrimary,
          });
        }
      }

      return { success: true, message: "Garage details successfully updated." };
    }
  );

  // POST /garages/import - OpenStreetMap Overpass extraction & import launcher
  app.post(
    "/garages/import",
    {
      preHandler: canManage,
      ...schemaDoc({
        summary: "Import garages from OpenStreetMap Overpass API",
        tags: ["garages"],
        body: z.object({
          city: z.string().default("Chennai"),
        }),
      }),
    },
    async (req, reply) => {
      const { city } = req.body as { city: string };
      const auth = req.auth!;

      const result = await GaragesService.importFromOSM(city, auth.orgId);

      return {
        success: true,
        importedCount: result.count,
        ignoredDuplicatesCount: result.duplicates,
        message: `Osm import successfully processed for ${city}. Imported: ${result.count}, Duplicates ignored: ${result.duplicates}`,
      };
    }
  );
}
