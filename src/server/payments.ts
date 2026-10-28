import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPayment } from "@/server/integrations/saspay/client";

type Json = Record<string, any>;
export type ProcessResult = "confirmed" | "failed" | "pending" | "unmatched" | "ignored";

// Traite un événement webhook déjà enregistré : le webhook ne fait que DÉCLENCHER la vérification serveur.
// Idempotent : confirm_payment() ignore une transaction déjà enregistrée ; processed_at évite les rejeux.
export async function processPaymentEvent(eventId: number): Promise<ProcessResult> {
  const admin = createAdminClient();
  const { data: ev } = await admin.from("payment_events").select("*").eq("id", eventId).maybeSingle();
  if (!ev || ev.processed_at) return "ignored";

  const data: Json = ev.payload?.data ?? {};
  const txId = String(ev.provider_transaction_id);
  const v = await verifyPayment(txId);                       // source de vérité
  const status = String(v.status ?? "").toUpperCase();        // PENDING | SUCCESS | FAILED

  // Rattachement à la tentative : metadata envoyée à la création du checkout.
  // NON VÉRIFIÉ : SasPay renvoie-t-il `metadata` dans verify / webhook ? À valider avec une clé sk_test_.
  const attemptId: string | undefined = v.metadata?.attempt_id ?? data.metadata?.attempt_id;
  if (!attemptId) return "unmatched";
  const { data: attempt } = await admin.from("payment_attempts").select("id, amount, currency, status").eq("id", attemptId).maybeSingle();
  if (!attempt) return "unmatched";

  const done = async () => { await admin.from("payment_events").update({ processed_at: new Date().toISOString() }).eq("id", eventId); };

  if (status === "SUCCESS") {
    // Comptabilité : charged = ce que le payeur débourse, net_amount = ce qui revient à l'université (jamais `amount` seul).
    const charged = v.debited_amount ?? v.amounts?.charged ?? data.charged;
    const net = v.net_amount ?? data.net_amount;
    if (charged == null || net == null) throw new Error("charged / net_amount absents de la vérification");
    if (v.currency && String(v.currency) !== String(attempt.currency)) throw new Error("devise différente de la tentative");
    const { error } = await admin.rpc("confirm_payment", {
      p_attempt: attempt.id, p_txn: txId,
      p_amount: String(attempt.amount),                       // montant facturé, fixé par le serveur
      p_charged: String(charged), p_net: String(net), p_currency: attempt.currency,
      p_method: v.method ?? null, p_network: v.network_code ?? v.network ?? null,
    });
    if (error) throw error;
    await done();
    return "confirmed";
  }
  if (status === "FAILED") {
    await admin.from("payment_attempts").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", attempt.id).neq("status", "success");
    await done();
    return "failed";
  }
  if (ev.event_type === "transaction.cancelled") {          // état terminal non réussi
    await admin.from("payment_attempts").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", attempt.id).neq("status", "success");
    await done();
    return "failed";
  }
  return "pending";                                           // PENDING : rien n'est livré, on revérifiera
}
