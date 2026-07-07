export interface ProviderField {
  key: string;
  label: string;
  type: "text" | "password" | "select";
  placeholder?: string;
  secret?: boolean; // masked when read back
  options?: { value: string; label: string }[]; // for type "select"
}

export interface ProviderDef {
  provider: string;
  name: string;
  category: "telephony" | "messaging" | "localization" | "automation";
  description: string;
  region: string;
  capabilities: string[]; // e.g. "call", "whatsapp", "translate", "voice_agent"
  fields: ProviderField[];
}

// Languages Google Cloud Translation supports that matter for the Indian market.
// Labelled with the native script so owners recognise their customers' language.
export const INDIAN_LANGUAGES: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi — हिन्दी" },
  { value: "ta", label: "Tamil — தமிழ்" },
  { value: "te", label: "Telugu — తెలుగు" },
  { value: "kn", label: "Kannada — ಕನ್ನಡ" },
  { value: "ml", label: "Malayalam — മലയാളം" },
  { value: "mr", label: "Marathi — मराठी" },
  { value: "bn", label: "Bengali — বাংলা" },
  { value: "gu", label: "Gujarati — ગુજરાતી" },
  { value: "pa", label: "Punjabi — ਪੰਜਾਬੀ" },
  { value: "or", label: "Odia — ଓଡ଼ିଆ" },
  { value: "as", label: "Assamese — অসমীয়া" },
  { value: "ur", label: "Urdu — اردو" },
];

// Static catalogue of connectors available to every org. India-first: Exotel
// for click-to-call, WhatsApp Business API (Meta Cloud + Gupshup BSP) for messaging.
export const PROVIDER_REGISTRY: ProviderDef[] = [
  {
    provider: "sarvam_shilpa",
    name: "Shilpa AI Voice Agent (Sarvam AI)",
    category: "automation",
    region: "India",
    description:
      "Outbound voice agent Shilpa speaks native Tamil to follow up on booking requests, pitch detailing services, and confirm client appointments automatically.",
    capabilities: ["voice_agent"],
    fields: [
      {
        key: "apiKey",
        label: "Sarvam AI API Key",
        type: "password",
        secret: true,
        placeholder: "Enter Sarvam API Key",
      },
      {
        key: "voiceId",
        label: "Voice Accent & Gender",
        type: "select",
        options: [
          { value: "shilpa_tamil", label: "Shilpa (Tamil — Female Accent)" },
          { value: "shilpa_expressive", label: "Shilpa Expressive (Tamil)" },
        ],
        placeholder: "Select Voice ID",
      },
      {
        key: "promptTemplate",
        label: "Voice Agent Prompt/Context",
        type: "text",
        placeholder: "You are Shilpa, a helpful assistant calling from Xpart Automotive...",
      },
      {
        key: "enableAutoRescheduling",
        label: "Auto-Reschedule on Busy",
        type: "select",
        options: [
          { value: "true", label: "Enabled" },
          { value: "false", label: "Disabled" },
        ],
        placeholder: "Select rescheduling behavior",
      },
    ],
  },
  {
    provider: "exotel",
    name: "Exotel",
    category: "telephony",
    region: "India",
    description: "Indian cloud telephony — click-to-call and call masking from the Client 360° queue.",
    capabilities: ["call"],
    fields: [
      { key: "sid", label: "Account SID", type: "text", placeholder: "your-exotel-sid" },
      { key: "apiKey", label: "API Key", type: "password", secret: true },
      { key: "apiToken", label: "API Token", type: "password", secret: true },
      { key: "callerId", label: "ExoPhone / Caller ID", type: "text", placeholder: "08047xxxxxx" },
    ],
  },
  {
    provider: "knowlarity",
    name: "Knowlarity",
    category: "telephony",
    region: "India",
    description: "Indian cloud call-center connector — outbound calling and IVR follow-ups.",
    capabilities: ["call"],
    fields: [
      { key: "apiKey", label: "API Key", type: "password", secret: true },
      { key: "callerId", label: "Caller ID", type: "text", placeholder: "+9180xxxxxxx" },
    ],
  },
  {
    provider: "whatsapp_cloud",
    name: "WhatsApp Business API (Meta Cloud)",
    category: "messaging",
    region: "Global / India",
    description: "Send template & service reminders directly via Meta's official WhatsApp Cloud API.",
    capabilities: ["whatsapp"],
    fields: [
      { key: "phoneNumberId", label: "Phone Number ID", type: "text", placeholder: "1009xxxxxxxxx" },
      { key: "businessAccountId", label: "WhatsApp Business Account ID", type: "text" },
      { key: "accessToken", label: "Permanent Access Token", type: "password", secret: true },
    ],
  },
  {
    provider: "gupshup",
    name: "WhatsApp via Gupshup",
    category: "messaging",
    region: "India",
    description: "Indian WhatsApp BSP — high-volume template messaging with local support.",
    capabilities: ["whatsapp"],
    fields: [
      { key: "apiKey", label: "API Key", type: "password", secret: true },
      { key: "sourceNumber", label: "Registered WhatsApp Number", type: "text", placeholder: "9198xxxxxxxx" },
      { key: "appName", label: "App Name", type: "text" },
    ],
  },
  {
    provider: "google_translate",
    name: "Google Cloud Translation",
    category: "localization",
    region: "India",
    description:
      "Auto-translate reminders, WhatsApp templates, offers and invoices into your customer's language — Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali and more — using Google Cloud Translation.",
    capabilities: ["translate"],
    fields: [
      { key: "apiKey", label: "Google Cloud API Key", type: "password", secret: true, placeholder: "AIza…" },
      { key: "projectId", label: "GCP Project ID", type: "text", placeholder: "my-gcp-project" },
      {
        key: "defaultTargetLanguage",
        label: "Default customer language",
        type: "select",
        options: INDIAN_LANGUAGES,
        placeholder: "Pick a language",
      },
      {
        key: "sourceLanguage",
        label: "Content authored in",
        type: "select",
        options: INDIAN_LANGUAGES,
        placeholder: "Pick a language",
      },
      {
        key: "model",
        label: "Translation model",
        type: "select",
        placeholder: "Pick a model",
        options: [
          { value: "nmt", label: "Neural (NMT) — best quality" },
          { value: "base", label: "Base (PBMT) — cheaper" },
        ],
      },
    ],
  },
];

export function getProvider(provider: string): ProviderDef | undefined {
  return PROVIDER_REGISTRY.find((p) => p.provider === provider);
}

// Returns a masked copy of stored config — secrets shown as ••••last4 only.
export function maskConfig(def: ProviderDef, config: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of def.fields) {
    const raw = config[field.key];
    if (raw == null || raw === "") {
      out[field.key] = "";
    } else if (field.secret) {
      const s = String(raw);
      out[field.key] = `••••${s.slice(-4)}`;
    } else {
      out[field.key] = String(raw);
    }
  }
  return out;
}
