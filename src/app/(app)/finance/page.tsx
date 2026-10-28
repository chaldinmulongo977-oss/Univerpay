import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { requirePermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Finances" };

export default async function FinancePage() {
  const access = await requirePermission("payments.read");
  const supabase = await createClient();
  const { data: payments } = await supabase.from("payments")
    .select("id, currency, amount, fee, net_amount, method, network, confirmed_at, provider_transaction_id")
    .order("confirmed_at", { ascending: false }).limit(50);
  const currencies = [...new Set((payments ?? []).map((p) => p.currency as string))];

  // Trois montants séparés : confirmés, réglés en banque, non rapprochés.
  const gaps = access.permissions.has("accounting.read")
    ? await Promise.all(currencies.map(async (c) => {
        const { data } = await supabase.rpc("kpi_settlement_gap", { p_currency: c });
        const g = (data as { confirmed_net: string; settled_net: string; unreconciled: string }[] | null)?.[0];
        return { currency: c, ...g };
      }))
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Finances</h1>
      {gaps.map((g) => (
        <section key={g.currency} className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label={`Rapprochement ${g.currency}`}>
          <KpiCard label={`Confirmé (net) ${g.currency}`} value={formatMoney(g.confirmed_net ?? 0, g.currency)} />
          <KpiCard label="Réglé en banque" value={formatMoney(g.settled_net ?? 0, g.currency)} />
          <KpiCard label="Non rapproché" value={formatMoney(g.unreconciled ?? 0, g.currency)} hint="Confirmé mais pas encore réglé" />
        </section>
      ))}
      <Card>
        <CardHeader><CardTitle>Derniers paiements confirmés</CardTitle></CardHeader>
        <CardContent>
          {!payments?.length ? <EmptyState title="Aucun paiement confirmé" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">Date</th><th className="pr-3">Montant</th><th className="pr-3">Frais</th><th className="pr-3">Net</th><th className="pr-3">Moyen</th><th>Statut</th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap">{new Date(p.confirmed_at).toLocaleDateString("fr-FR")}</td>
                      <td className="pr-3">{formatMoney(p.amount, p.currency)}</td>
                      <td className="pr-3">{formatMoney(p.fee, p.currency)}</td>
                      <td className="pr-3">{formatMoney(p.net_amount, p.currency)}</td>
                      <td className="pr-3">{[p.method, p.network].filter(Boolean).join(" · ") || "—"}</td>
                      <td><Badge variant="success">Confirmé</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
