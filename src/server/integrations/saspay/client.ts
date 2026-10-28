// Client SasPay — serveur uniquement. Spécification : https://docs.saspay.me/api-reference/openapi.json
// Routes utilisées : POST /checkout-sessions/ et GET /payments/{payment_id}/verify/. Aucune autre route n'est inventée.
// Enveloppe de réponse : { success, data, code } ; erreurs : { success:false, error:{message,code}, code } ou { champ: [messages] }.

export class SaspayError extends Error {
  constructor(public status: number, public code: string | null, message: string) { super(message); }
  /** Message sûr à montrer à l'utilisateur (aucun détail technique ni secret). */
  get userMessage() {
    if (this.status === 429) return "Trop de requêtes. Réessayez dans quelques instants.";
    if (this.status === 422) return "Ce paiement n'est pas possible en l'état. Contactez l'administration.";
    return "Le service de paiement est indisponible. Réessayez plus tard.";
  }
}

function baseUrl() { return process.env.SASPAY_API_BASE_URL ?? "https://api.saspay.me/api/v1"; }

async function call(path: string, init: { method?: string; body?: unknown } = {}) {
  const key = process.env.SASPAY_API_KEY;              // jamais loguée, jamais renvoyée au navigateur
  if (!key) throw new SaspayError(500, "missing_api_key", "SASPAY_API_KEY manquante");
  const res = await fetch(`${baseUrl()}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    const code = typeof json?.error?.code === "string" ? json.error.code : null;
    const msg = json?.error?.message ?? (json ? JSON.stringify(Object.keys(json)) : "réponse vide");
    // 401 : clé invalide, ne pas réessayer. 403 : compte suspendu / ressource non rattachée.
    // 409 : conflit, vérifier avant de réexécuter. 429 : on espace les appels, jamais de boucle ici.
    throw new SaspayError(res.status, code, `SasPay ${res.status}${code ? ` ${code}` : ""}: ${msg}`);
  }
  return (json?.data ?? json) as Record<string, any>;
}

export type CheckoutInput = {
  amount: string;                 // chaîne décimale : "2500.00", jamais un flottant
  currency: string;
  customer_email: string;
  customer_name: string;
  description?: string;
  customer_phone?: string;
  return_url?: string;
  metadata?: Record<string, unknown>;
  fee_charge_mode?: "ADD_ON" | "DEDUCTED";
};

// POST /checkout-sessions/ : n'accepte PAS d'Idempotency-Key. Le double clic est géré côté UniPay
// (réutilisation de la tentative en attente), voir src/app/api/payments/checkout/route.ts.
export function createCheckoutSession(input: CheckoutInput) {
  return call("/checkout-sessions/", { method: "POST", body: input });
}

// GET /payments/{payment_id}/verify/ : seul « SUCCESS » autorise la livraison (confirmation du paiement).
export function verifyPayment(paymentId: string) {
  return call(`/payments/${encodeURIComponent(paymentId)}/verify/`);
}
