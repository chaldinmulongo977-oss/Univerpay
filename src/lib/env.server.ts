import "server-only";
import { z } from "zod";

// Secrets : lus uniquement côté serveur, validés à la première utilisation.
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SASPAY_API_BASE_URL: z.string().url().default("https://api.saspay.me/api/v1"),
  SASPAY_API_KEY: z.string().regex(/^sk_(test|live)_/, "SASPAY_API_KEY doit commencer par sk_test_ ou sk_live_"),
  SASPAY_WEBHOOK_SECRET: z.string().min(8),
});
let cached: z.infer<typeof serverSchema> | null = null;
export function serverEnv() {
  if (!cached) cached = serverSchema.parse(process.env);
  return cached;
}
