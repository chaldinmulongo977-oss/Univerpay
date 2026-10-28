import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCheckoutSession, SaspayError } from "@/server/integrations/saspay/client";

const bodySchema = z.object({ invoiceId: z.string().uuid(), amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional() });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  const { invoiceId, amount: requested } = parsed.data;

  // Lecture avec le client UTILISATEUR : la RLS garantit qu'il a le droit de voir (et payer) cette facture.
  const { data: invoice } = await supabase.from("invoices")
    .select("id, currency, status, allows_partial").eq("id", invoiceId).maybeSingle();
  if (!invoice || !["issued", "partially_paid"].includes(invoice.status)) {
    return NextResponse.json({ error: "Facture non payable" }, { status: 404 });
  }
  const { data: bal } = await supabase.from("invoice_balances").select("balance").eq("invoice_id", invoiceId).maybeSingle();
  const balance = Number(bal?.balance ?? 0);
  if (balance <= 0) return NextResponse.json({ error: "Aucun solde à payer" }, { status: 409 });

  // Le montant est fixé ICI, jamais pris tel quel du navigateur.
  let amount = balance;
  if (requested) {
    const n = Number(requested);
    if (!invoice.allows_partial && n !== balance) return NextResponse.json({ error: "Paiement partiel non autorisé" }, { status: 400 });
    if (n <= 0 || n > balance) return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
    amount = n;
  }

  const admin = createAdminClient();
  // Double clic : SasPay n'accepte pas d'Idempotency-Key ici ; on réutilise la session en attente (30 min max).
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: open } = await admin.from("payment_attempts").select("checkout_url")
    .eq("invoice_id", invoiceId).eq("status", "pending").eq("amount", amount.toFixed(2)).eq("initiated_by", user.id)
    .gt("created_at", since).not("checkout_url", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (open?.checkout_url) return NextResponse.json({ checkoutUrl: open.checkout_url });

  const { data: profile } = await supabase.from("user_profiles").select("first_name,last_name,phone").eq("id", user.id).maybeSingle();
  const reference = `UP-${randomUUID()}`;
  const { data: attempt, error: insErr } = await admin.from("payment_attempts").insert({
    invoice_id: invoiceId, reference, amount: amount.toFixed(2), currency: invoice.currency, initiated_by: user.id,
  }).select("id").single();
  if (insErr || !attempt) return NextResponse.json({ error: "Impossible de créer le paiement" }, { status: 500 });

  try {
    const session = await createCheckoutSession({
      amount: amount.toFixed(2),
      currency: invoice.currency,
      description: `Facture ${reference}`,
      customer_email: user.email ?? "",
      customer_name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Étudiant",
      customer_phone: profile?.phone ?? undefined,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/student/invoices`,
      metadata: { attempt_id: attempt.id, invoice_id: invoiceId },
    });
    const checkoutUrl: string | undefined = session.checkout_url;
    const checkoutId: string | undefined = session.id;
    if (!checkoutUrl) throw new Error("checkout_url absent");
    await admin.from("payment_attempts").update({ provider_checkout_id: checkoutId, checkout_url: checkoutUrl, status: "pending", updated_at: new Date().toISOString() }).eq("id", attempt.id);
    return NextResponse.json({ checkoutUrl });
  } catch (e) {
    await admin.from("payment_attempts").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", attempt.id);
    const err = e instanceof SaspayError ? e : null;
    if (err) console.error("saspay checkout", err.status, err.code);      // jamais la clé, jamais le corps complet
    return NextResponse.json({ error: err?.userMessage ?? "Le service de paiement est indisponible. Réessayez plus tard." }, { status: err?.status === 429 ? 429 : 502 });
  }
}
