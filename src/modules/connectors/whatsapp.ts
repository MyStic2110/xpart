import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { connectors, organizations } from "@/db/schema";

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
export async function sendWhatsApp(orgId: string, toPhone: string, message: string): Promise<SendResult> {
  const conn = await db.query.connectors.findFirst({
    where: and(eq(connectors.orgId, orgId), inArray(connectors.provider, WHATSAPP_PROVIDERS), eq(connectors.status, "active")),
  });

  if (!conn) {
    return { sent: false, provider: null, reason: "connector_not_configured", message };
  }

  // TODO(activation): real provider call goes here, using conn.config.
  //  - whatsapp_cloud: POST https://graph.facebook.com/v19.0/{phoneNumberId}/messages
  //      headers: Authorization: Bearer {accessToken}
  //      body: { messaging_product: "whatsapp", to: "91" + toPhone, type: "text", text: { body: message } }
  //  - gupshup: POST https://api.gupshup.io/wa/api/v1/msg
  //      headers: apikey: {apiKey}
  //      form: channel=whatsapp, source={sourceNumber}, destination=91{toPhone},
  //            message={"type":"text","text":message}, src.name={appName}
  console.log(`[whatsapp:${conn.provider}] queued (adapter not activated) → ${toPhone}: ${message.slice(0, 80)}...`);
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
    const message = referralInviteMessage({
      clientName: client.name,
      referralCode: client.referralCode,
      businessName: org?.name ?? "our workshop",
    });
    return await sendWhatsApp(orgId, client.phone, message);
  } catch (err) {
    console.error("referral invite failed", err);
    return null;
  }
}
