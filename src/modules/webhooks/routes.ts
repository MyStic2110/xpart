import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { clients } from "@/db/schema";
import { env } from "@/env";

// Webhook verify token can be set via env, defaulting to 'xpart-verify-token'
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "xpart-verify-token";

export async function webhookRoutes(app: FastifyInstance) {
  // GET: Meta webhook verification
  app.get("/webhooks/whatsapp", async (req, reply) => {
    const query = req.query as Record<string, string | undefined>;
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    console.log("[webhook] GET verify token request:", { mode, token, challenge });

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[webhook] Verification successful");
      return reply.code(200).send(challenge);
    } else {
      console.warn("[webhook] Verification failed");
      return reply.code(403).send("Forbidden");
    }
  });

  // POST: Receive inbound WhatsApp messages (Meta Cloud API or Gupshup)
  app.post("/webhooks/whatsapp", async (req, reply) => {
    const body = req.body as any;
    console.log("[webhook] POST message payload received:", JSON.stringify(body));

    let fromPhone: string | null = null;

    try {
      // 1. Check Meta Cloud API structure
      // entry[] -> changes[] -> value -> messages[] -> from
      if (body.object === "whatsapp_business_account" && Array.isArray(body.entry)) {
        for (const entry of body.entry) {
          if (Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
              if (change.value && Array.isArray(change.value.messages)) {
                for (const msg of change.value.messages) {
                  if (msg.from) {
                    fromPhone = String(msg.from);
                    break;
                  }
                }
              }
            }
          }
        }
      }

      // 2. Check Gupshup structure
      // e.g. payload -> sender -> phone
      if (!fromPhone && body.payload && body.payload.sender && body.payload.sender.phone) {
        fromPhone = String(body.payload.sender.phone);
      }

      // 3. Fallback check for mobile number directly
      if (!fromPhone && body.mobile) {
        fromPhone = String(body.mobile);
      }

      if (fromPhone) {
        // Sanitize phone: extract last 10 digits (assumes Indian 10-digit format stored in DB)
        const cleanPhone = fromPhone.slice(-10);
        if (/^\d{10}$/.test(cleanPhone)) {
          console.log(`[webhook] Inbound message detected from phone: ${cleanPhone}. Updating lastInteractionAt.`);
          
          await db
            .update(clients)
            .set({ lastInteractionAt: new Date() })
            .where(eq(clients.phone, cleanPhone));
        } else {
          console.warn(`[webhook] Ignored message from non-standard number format: ${fromPhone}`);
        }
      } else {
        console.log("[webhook] No sender phone found in payload. Skipping client update.");
      }
    } catch (err) {
      console.error("[webhook] Error parsing incoming WhatsApp message:", err);
    }

    // Always return 200 OK to acknowledge receipt
    return reply.code(200).send({ success: true });
  });
}
