import "dotenv/config";
import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  PORT: z.coerce.number().default(3000),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
}).refine(
  (data) => {
    if (isProduction) {
      const defaultPlaceholder = "change-this-to-a-long-random-string";
      const val = data.JWT_SECRET.toLowerCase();
      if (
        data.JWT_SECRET === defaultPlaceholder ||
        val.includes("secret") ||
        val.includes("change-this") ||
        val.includes("123456") ||
        val.includes("qwerty")
      ) {
        return false;
      }
    }
    return true;
  },
  {
    message: "In production, JWT_SECRET must be set to a secure, non-default value",
    path: ["JWT_SECRET"],
  }
);

export const env = envSchema.parse(process.env);
