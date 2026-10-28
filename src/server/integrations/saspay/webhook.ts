import { createHmac, timingSafeEqual } from "node:crypto";

// Vérification documentée par SasPay (docs.saspay.me/api-reference/webhooks) :
// signature = HMAC-SHA256(secret, `${timestamp}.${corpsBrut}`) en hexadécimal minuscule,
// et rejet si l'horodatage s'écarte de plus de 300 s.
const TOLERANCE_SECONDS = 300;

export function verifySaspayWebhook(
  rawBody: string, // corps BRUT, jamais re-sérialisé
  signature: string | null, // en-tête X-Webhook-Signature
  timestamp: string | null, // en-tête X-Webhook-Timestamp
  secret: string,
): boolean {
  if (!signature || !timestamp || !secret) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
