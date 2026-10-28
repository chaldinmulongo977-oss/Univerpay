import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { PrintButton } from "@/components/dashboard/print-button";
import { requireAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Reçu" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess();
  const { id } = await params;
  const supabase = await createClient();
  // RLS : un reçu n'est lisible que par le payeur autorisé ou le personnel financier.
  const { data: r } = await supabase
    .from("receipts")
    .select("number, issued_at, payments(amount, currency, method, network, provider_transaction_id, payment_allocations(invoices(reference)))")
    .eq("id", id).maybeSingle();
  if (!r) notFound();
  type P = { amount: string; currency: string; method: string | null; network: string | null; provider_transaction_id: string; payment_allocations: { invoices: { reference: string } | null }[] };
  const p = (Array.isArray(r.payments) ? r.payments[0] : r.payments) as unknown as P;

  return (
    <article className="mx-auto max-w-xl space-y-4 rounded-lg border bg-card p-6">
      <header className="flex items-center justify-between">
        <Logo size={48} withText />
        <div className="text-right text-sm"><p className="font-semibold">Reçu {r.number}</p>
          <p className="text-muted-foreground">{new Date(r.issued_at).toLocaleDateString("fr-FR")}</p></div>
      </header>
      <p className="text-sm text-muted-foreground">Université Révérend Kim</p>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between"><dt>Facture(s)</dt><dd>{p.payment_allocations.map((a) => a.invoices?.reference).filter(Boolean).join(", ")}</dd></div>
        <div className="flex justify-between"><dt>Moyen de paiement</dt><dd>{[p.method, p.network].filter(Boolean).join(" · ") || "—"}</dd></div>
        <div className="flex justify-between"><dt>Transaction</dt><dd className="break-all">{p.provider_transaction_id}</dd></div>
        <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>Montant payé</dt><dd>{formatMoney(p.amount, p.currency)}</dd></div>
      </dl>
      <PrintButton />
    </article>
  );
}
