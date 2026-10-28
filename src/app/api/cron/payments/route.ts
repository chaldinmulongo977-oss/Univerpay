import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processPaymentEvent } from "@/server/payments";

export const runtime = "nodejs";

// Reprise des événements non traités (ex. échec réseau pendant la vérification). Protégé par CRON_SECRET.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: events } = await admin.from("payment_events").select("id")
    .is("processed_at", null).lt("received_at", cutoff).order("id").limit(20);
  const results: Record<string, string> = {};
  for (const e of events ?? []) {                              // séquentiel : on reste loin des 300 requêtes/minute
    try { results[e.id] = await processPaymentEvent(e.id); } catch (err) { results[e.id] = "erreur"; }
  }
  return NextResponse.json({ processed: results });
}
