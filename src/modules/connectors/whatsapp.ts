import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { connectors, organizations, clients } from "@/db/schema";

// ---------------------------------------------------------------------------
// WhatsApp outbound messaging.
//
// The connectors hub stores WhatsApp provider config (whatsapp_cloud / gupshup)
// but the adapters intentionally do NOT execute yet — the real HTTP call is a
// single TODO below, to be filled in when the client activates their provider
// account. Everything around it (template, trigger, provider resolution,
// result reporting) is live, so activation is a one-function change.
// ---------------------------------------------------------------------------

export interface SendResult {
  sent: boolean;
  provider: string | null;
  // Why nothing went out (absent when sent=true):
  //  - connector_not_configured: org hasn't connected a WhatsApp provider
  //  - adapter_not_activated: config saved, but live sending not switched on yet
  reason?: "connector_not_configured" | "adapter_not_activated";
  message: string; // the exact message body, so callers/UI can show or reuse it
}

export interface WhatsAppTemplate {
  name: string;
  languageCode?: string;
  parameters: string[];
}

const WHATSAPP_PROVIDERS = ["whatsapp_cloud", "gupshup"];

// "Invite your Friends & Earn points" — sent to a customer when their number is
// added, carrying their personal referral code.
export function referralInviteMessage(opts: { clientName: string; referralCode: string; businessName: string }) {
  return (
    `Hi ${opts.clientName}! 👋 Welcome to ${opts.businessName}.\n\n` +
    `🎁 *Invite your Friends & Earn points*\n` +
    `You & your friend will each get *500 points* on your friend's first billing.\n\n` +
    `Your referral code:\n*${opts.referralCode}*\n\n` +
    `Share this code with friends — they mention it on their first visit, and you both earn. ` +
    `Points can be redeemed against any bill at ${opts.businessName}.`
  );
}

// Send a WhatsApp message via whichever provider the org has connected.
// Never throws — messaging must not break the business flow that triggered it.
export async function sendWhatsApp(
  orgId: string,
  toPhone: string,
  message: string,
  template?: WhatsAppTemplate
): Promise<SendResult> {
  const conn = await db.query.connectors.findFirst({
    where: and(eq(connectors.orgId, orgId), inArray(connectors.provider, WHATSAPP_PROVIDERS), eq(connectors.status, "active")),
  });

  if (!conn) {
    return { sent: false, provider: null, reason: "connector_not_configured", message };
  }

  const config = conn.config as Record<string, string>;

  // Check if we can bypass the template and send a raw text message instead.
  // This is possible if the customer has interacted (inbound message) within the last 24 hours.
  let useTemplate = !!template;
  if (template) {
    try {
      const client = await db.query.clients.findFirst({
        where: and(eq(clients.orgId, orgId), eq(clients.phone, toPhone)),
      });
      if (client && client.lastInteractionAt) {
        const lastInteractionTime = new Date(client.lastInteractionAt).getTime();
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
        if (lastInteractionTime > twentyFourHoursAgo) {
          console.log(`[whatsapp] Session window active for ${toPhone} (last interaction: ${client.lastInteractionAt}). Sending raw text message.`);
          useTemplate = false;
        }
      }
    } catch (err) {
      console.error("[whatsapp] Error checking client session window:", err);
    }
  }

  try {
    if (conn.provider === "whatsapp_cloud") {
      const { phoneNumberId, accessToken } = config;
      if (!accessToken) {
        console.log(`[whatsapp_cloud] accessToken not configured yet — skipping send to ${toPhone}`);
        return { sent: false, provider: conn.provider, reason: "adapter_not_activated", message };
      }

      const body: Record<string, any> = {
        messaging_product: "whatsapp",
        to: `91${toPhone}`,
      };

      if (useTemplate && template) {
        body.type = "template";
        body.template = {
          name: template.name,
          language: { code: template.languageCode || "en" },
          components: [
            {
              type: "body",
              parameters: template.parameters.map((param) => ({
                type: "text",
                text: param,
              })),
            },
          ],
        };
      } else {
        body.type = "text";
        body.text = { body: message };
      }

      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`[whatsapp_cloud] send failed (${res.status}):`, errBody);
        return { sent: false, provider: conn.provider, reason: "adapter_not_activated", message };
      }

      console.log(`[whatsapp_cloud] ✓ sent to ${toPhone} (template: ${useTemplate})`);
      return { sent: true, provider: conn.provider, message };

    } else if (conn.provider === "gupshup") {
      const { apiKey, sourceNumber, appName } = config;
      if (!apiKey) {
        console.log(`[gupshup] apiKey not configured yet — skipping send to ${toPhone}`);
        return { sent: false, provider: conn.provider, reason: "adapter_not_activated", message };
      }

      const form = new URLSearchParams();
      form.append("channel", "whatsapp");
      form.append("source", sourceNumber);
      form.append("destination", `91${toPhone}`);
      form.append("src.name", appName);

      const messagePayload = useTemplate && template
        ? {
            type: "template",
            template: {
              id: template.name,
              params: template.parameters,
            },
          }
        : { type: "text", text: message };

      form.append("message", JSON.stringify(messagePayload));

      const res = await fetch("https://api.gupshup.io/wa/api/v1/msg", {
        method: "POST",
        headers: { apikey: apiKey },
        body: form,
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`[gupshup] send failed (${res.status}):`, errBody);
        return { sent: false, provider: conn.provider, reason: "adapter_not_activated", message };
      }

      console.log(`[gupshup] ✓ sent to ${toPhone} (template: ${useTemplate})`);
      return { sent: true, provider: conn.provider, message };
    }
  } catch (err) {
    // Network error, DNS failure, timeout — never break the calling business flow
    console.error(`[whatsapp:${conn.provider}] send error to ${toPhone}:`, err);
    return { sent: false, provider: conn.provider, reason: "adapter_not_activated", message };
  }

  return { sent: false, provider: conn.provider, reason: "adapter_not_activated", message };
}

// Fire the referral invite for a newly added customer. Third-party vendors are
// not customers — they never receive referral/points messaging.
export async function sendReferralInvite(
  orgId: string,
  client: { name: string; phone: string; referralCode: string; clientType: string }
): Promise<SendResult | null> {
  if (client.clientType === "third_party") return null;
  try {
    const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) });
    const businessName = org?.name ?? "our workshop";
    const message = referralInviteMessage({
      clientName: client.name,
      referralCode: client.referralCode,
      businessName,
    });
    return await sendWhatsApp(orgId, client.phone, message, {
      name: "referral_invite",
      parameters: [client.name, businessName, client.referralCode],
    });
  } catch (err) {
    console.error("referral invite failed", err);
    return null;
  }
}
