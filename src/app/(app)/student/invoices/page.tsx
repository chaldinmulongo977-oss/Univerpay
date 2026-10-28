import Link from "next/link";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { PayButton } from "@/components/dashboard/pay-button";
import { requireAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Mes factures" };

type Row = {
  id: string; reference: string; currency: string; status: string; due_date: string | null; allows_partial: boolean;
  invoice_balances: { amount_due: string; amount_paid: string; balance: string } | { amount_due: string; amount_paid: string; balance: string }[] | null;
};

export default async function InvoicesPage() {
  await requireAccess();
  const supabase = await createClient();
  // La RLS (can_see_invoice) ne renvoie que les factures de l'utilisateur ou de ses enfants autorisés.
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, reference, currency, status, due_date, allows_partial")
    .neq("status", "draft").order("created_at", { ascending: false });
  const ids = (invoices ?? []).map((i) => i.id);
  const { data: balances } = ids.length
    ? await supabase.from("invoice_balances").select("invoice_id, amount_due, amount_paid, balance").in("invoice_id", ids)
    : { data: [] };
  const byId = new Map((balances ?? []).map((b) => [b.invoice_id as string, b]));

  const { data: receipts } = ids.length
    ? await supabase.from("payment_allocations").select("invoice_id, payment_id, payments(receipts(id, number))").in("invoice_id", ids)
    : { data: [] };
  type RcRow = { invoice_id: string; payments: { receipts: { id: string; number: string }[] | { id: string; number: string } | null } | null };
  const receiptsByInvoice = new Map<string, { id: string; number: string }[]>();
  ((receipts ?? []) as unknown as RcRow[]).forEach((r) => {
    const rc = r.payments?.receipts; const list = Array.isArray(rc) ? rc : rc ? [rc] : [];
    receiptsByInvoice.set(r.invoice_id, [...(receiptsByInvoice.get(r.invoice_id) ?? []), ...list]);
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Mes factures</h1>
      {!invoices?.length && <EmptyState title="Aucune facture" hint="Vos factures apparaîtront ici dès leur émission." />}
      {(invoices as unknown as Row[] | null)?.map((inv) => {
        const b = byId.get(inv.id);
        const balance = Number(b?.balance ?? 0);
        return (
          <Card key={inv.id}>
            <CardHeader className="flex-row items-start justify-between gap-2">
              <div><CardTitle>{inv.reference}</CardTitle>
                {inv.due_date && <p className="text-sm text-muted-foreground">Échéance : {new Date(inv.due_date).toLocaleDateString("fr-FR")}</p>}</div>
              <Badge variant={statusVariant(inv.status)}>{inv.status === "paid" ? "Payée" : inv.status === "partially_paid" ? "Partielle" : "À payer"}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-muted-foreground">Facturé</dt><dd className="font-semibold">{formatMoney(b?.amount_due ?? 0, inv.currency)}</dd></div>
                <div><dt className="text-muted-foreground">Payé</dt><dd className="font-semibold text-success">{formatMoney(b?.amount_paid ?? 0, inv.currency)}</dd></div>
                <div><dt className="text-muted-foreground">Solde</dt><dd className="font-semibold">{formatMoney(balance, inv.currency)}</dd></div>
              </dl>
              {balance > 0 && inv.status !== "cancelled" && <PayButton invoiceId={inv.id} balance={balance} allowsPartial={inv.allows_partial} />}
              {(receiptsByInvoice.get(inv.id) ?? []).map((r) => (
                <Link key={r.id} href={`/student/receipts/${r.id}`} className="block text-sm text-primary underline">Reçu {r.number}</Link>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
