import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env.server";
import { verifySaspayWebhook } from "@/server/integrations/saspay/webhook";
import { processPaymentEvent } from "@/server/payments";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const raw = await request.text();                           // corps BRUT : jamais re-sérialisé avant la signature
  const valid = verifySaspayWebhook(
    raw,
    request.headers.get("x-webhook-signature"),
    request.headers.get("x-webhook-timestamp"),
    serverEnv().SASPAY_WEBHOOK_SECRET,
  );
  if (!valid) return NextResponse.json({ error: "Signature invalide" }, { status: 403 });

  let body: { event?: string; data?: { id?: string } };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  const event = request.headers.get("x-webhook-event") ?? body.event ?? "";
  const txId = body.data?.id ? String(body.data.id) : "";
  // Seuls les événements transaction.* nous concernent. settlement.* : contenu non garanti, ignoré ;
  // webhook.test : accepté pour valider la signature.
  if (!event.startsWith("transaction.") || !txId) return NextResponse.json({ received: true });

  const admin = createAdminClient();
  const ins = await admin.from("payment_events").insert({
    provider: "saspay", event_type: event, provider_transaction_id: txId, signature_valid: true, payload: body,
  }).select("id").single();
  let eventId = ins.data?.id as number | undefined;
  if (ins.error) {                                            // relivraison : unique (fournisseur, événement, transaction)
    const { data: existing } = await admin.from("payment_events").select("id, processed_at")
      .eq("provider", "saspay").eq("event_type", event).eq("provider_transaction_id", txId).maybeSingle();
    if (!existing || existing.processed_at) return NextResponse.json({ received: true, duplicate: true });
    eventId = existing.id;
  }

  // Réponse 2xx immédiate, traitement en arrière-plan. En cas d'échec, la tâche /api/cron/payments reprend les événements non traités.
  if (eventId) after(() => processPaymentEvent(eventId!).catch((e) => console.error("saspay event", eventId, e instanceof Error ? e.message : "erreur")));
  return NextResponse.json({ received: true });
}
