import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db/client";
import { branchCameras, branches } from "@/db/schema";
import { requireAuth, requireRole } from "@/middleware/auth";

// ---------------------------------------------------------------------------
// Branch cameras: provider-based config for CCTV/IP cams installed inside and
// outside each branch. Streams stay on the owner's LAN — this stores config
// and powers the settings UI + the in-browser MediaPipe AI monitor.
//
// Browser reality (kept honest in `browserPlayable`): RTSP cannot be decoded
// by a browser — those cameras need a media gateway (go2rtc / mediamtx → HLS)
// before live preview/AI works on them. MJPEG-over-HTTP and the device webcam
// work today.
// ---------------------------------------------------------------------------

export const CAMERA_PROVIDERS = [
  {
    provider: "hikvision",
    label: "Hikvision",
    urlTemplate: "rtsp://<ip>:554/Streaming/Channels/101",
    hint: "Main stream ch1: /Streaming/Channels/101 · sub stream: /Streaming/Channels/102",
    browserPlayable: false,
  },
  {
    provider: "dahua",
    label: "Dahua",
    urlTemplate: "rtsp://<ip>:554/cam/realmonitor?channel=1&subtype=0",
    hint: "subtype=0 main / subtype=1 sub stream",
    browserPlayable: false,
  },
  {
    provider: "cpplus",
    label: "CP Plus",
    urlTemplate: "rtsp://<ip>:554/cam/realmonitor?channel=1&subtype=0",
    hint: "Most CP Plus DVR/NVRs use the Dahua URL scheme",
    browserPlayable: false,
  },
  {
    provider: "tplink_tapo",
    label: "TP-Link Tapo",
    urlTemplate: "rtsp://<ip>:554/stream1",
    hint: "Create a camera account in the Tapo app first (Settings → Advanced → Camera account)",
    browserPlayable: false,
  },
  {
    provider: "generic_rtsp",
    label: "Generic RTSP / ONVIF",
    urlTemplate: "rtsp://<ip>:554/<path>",
    hint: "Any ONVIF/RTSP camera or NVR channel",
    browserPlayable: false,
  },
  {
    provider: "mjpeg_http",
    label: "MJPEG over HTTP (IP Webcam apps)",
    urlTemplate: "http://<ip>:8080/video",
    hint: "Android 'IP Webcam' app or any MJPEG endpoint — plays directly in the browser",
    browserPlayable: true,
  },
  {
    provider: "hls",
    label: "HLS stream (via gateway)",
    urlTemplate: "http://<gateway>:8888/<cam>/index.m3u8",
    hint: "Output of a go2rtc/mediamtx gateway converting your RTSP cams",
    browserPlayable: true,
  },
  {
    provider: "device_webcam",
    label: "This device's camera",
    urlTemplate: "(built-in — no URL needed)",
    hint: "Use the tablet/PC at the counter as a camera; works instantly with the AI monitor",
    browserPlayable: true,
  },
] as const;

const canManage = [requireAuth, requireRole("org_owner", "admin", "branch_manager")];

const cameraSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(1),
  placement: z.enum(["inside", "outside"]),
  provider: z.enum(CAMERA_PROVIDERS.map((p) => p.provider) as [string, ...string[]]),
  streamUrl: z.string().min(1),
  username: z.string().optional().or(z.literal("")),
  password: z.string().optional().or(z.literal("")),
  aiEnabled: z.boolean().optional(),
  notes: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "disabled"]).optional(),
});

function mask(cam: typeof branchCameras.$inferSelect) {
  return { ...cam, password: cam.password ? "••••••" : null };
}

export async function cameraRoutes(app: FastifyInstance) {
  app.get("/cameras", { preHandler: requireAuth }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { branchId } = req.query as { branchId?: string };
    const conds = [eq(branchCameras.orgId, orgId)];
    if (branchId && branchId !== "all") conds.push(eq(branchCameras.branchId, branchId));
    const rows = await db.select().from(branchCameras).where(and(...conds)).orderBy(asc(branchCameras.createdAt));
    return reply.send({ providers: CAMERA_PROVIDERS, cameras: rows.map(mask) });
  });

  app.post("/cameras", { preHandler: canManage }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const parsed = cameraSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "invalid input" });

    const branch = await db.query.branches.findFirst({ where: and(eq(branches.id, parsed.data.branchId), eq(branches.orgId, orgId)) });
    if (!branch) return reply.code(404).send({ error: "branch not found" });

    const [created] = await db
      .insert(branchCameras)
      .values({
        orgId,
        branchId: parsed.data.branchId,
        name: parsed.data.name,
        placement: parsed.data.placement,
        provider: parsed.data.provider,
        streamUrl: parsed.data.streamUrl,
        username: parsed.data.username || null,
        password: parsed.data.password || null,
        aiEnabled: parsed.data.aiEnabled ?? false,
        notes: parsed.data.notes || null,
      })
      .returning();
    return reply.code(201).send(mask(created));
  });

  app.patch("/cameras/:id", { preHandler: canManage }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: string };
    const existing = await db.query.branchCameras.findFirst({ where: and(eq(branchCameras.id, id), eq(branchCameras.orgId, orgId)) });
    if (!existing) return reply.code(404).send({ error: "camera not found" });

    const parsed = cameraSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "invalid input" });

    // A masked password coming back from an edit form must not overwrite the stored secret.
    const password =
      parsed.data.password === undefined || parsed.data.password.startsWith("••••")
        ? existing.password
        : parsed.data.password || null;

    const [updated] = await db
      .update(branchCameras)
      .set({
        name: parsed.data.name ?? existing.name,
        placement: parsed.data.placement ?? existing.placement,
        provider: parsed.data.provider ?? existing.provider,
        streamUrl: parsed.data.streamUrl ?? existing.streamUrl,
        username: parsed.data.username !== undefined ? parsed.data.username || null : existing.username,
        password,
        aiEnabled: parsed.data.aiEnabled ?? existing.aiEnabled,
        notes: parsed.data.notes !== undefined ? parsed.data.notes || null : existing.notes,
        status: parsed.data.status ?? existing.status,
        updatedAt: new Date(),
      })
      .where(eq(branchCameras.id, id))
      .returning();
    return reply.send(mask(updated));
  });

  app.delete("/cameras/:id", { preHandler: canManage }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: string };
    await db.delete(branchCameras).where(and(eq(branchCameras.id, id), eq(branchCameras.orgId, orgId)));
    return reply.send({ success: true });
  });
}
