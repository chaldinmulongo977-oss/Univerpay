import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ProgramChart } from "@/components/dashboard/program-chart";
import { requireAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const access = await requireAccess();
  const supabase = await createClient();
  const canReport = access.permissions.has("reports.read");

  // Staff avec rapports : KPI réels via fonctions SQL (contrôle de périmètre dans la base).
  if (canReport) {
    const { data: year } = await supabase.from("academic_years").select("id,label").eq("status", "active").maybeSingle();
    if (!year) {
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <EmptyState title="Aucune année académique active" hint="Créez et activez une année académique pour afficher les indicateurs." />
        </div>
      );
    }
    // Un doyen est limité à sa faculté ; un rôle global voit toute l'université.
    const facultyId = access.roles.find((r) => r.facultyId)?.facultyId ?? null;
    const globalReader = access.roles.some((r) => !r.facultyId && ["rector", "secretary_general_academic", "super_admin", "accountant", "budget_administrator"].includes(r.code));
    const scope = globalReader ? null : facultyId;

    const [enr, byProgram, billing] = await Promise.all([
      supabase.rpc("kpi_enrollment", { p_year: year.id, p_faculty: scope }),
      supabase.rpc("kpi_students_by_program", { p_year: year.id, p_faculty: scope }),
      supabase.rpc("kpi_billing", { p_year: year.id, p_faculty: scope }),
    ]);
    const e = (enr.data as { total: number; new_students: number; returning_students: number }[] | null)?.[0];
    const programs = ((byProgram.data ?? []) as { program_code: string; students: number }[]).map((p) => ({ name: p.program_code, students: Number(p.students) }));
    const bills = (billing.data ?? []) as { currency: string; billed: string; collected: string; balance: string; collection_rate: string | null }[];

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">Année académique {year.label}{scope ? " — votre faculté" : " — université"}</p>
        </div>
        <section aria-label="Effectifs" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <KpiCard label="Étudiants inscrits" value={String(e?.total ?? 0)} hint="Inscriptions valides" />
          <KpiCard label="Nouveaux étudiants" value={String(e?.new_students ?? 0)} hint="Première inscription valide cette année" />
          <KpiCard label="Anciens étudiants" value={String(e?.returning_students ?? 0)} hint="Déjà inscrits une année précédente" />
        </section>
        {bills.length > 0 && (
          <section aria-label="Finances" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bills.map((b) => (
              <Card key={b.currency}>
                <CardHeader><CardTitle>Facturation {b.currency}</CardTitle><CardDescription>Encaissé = paiements confirmés</CardDescription></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p>Facturé : <strong>{formatMoney(b.billed, b.currency)}</strong></p>
                  <p>Encaissé : <strong>{formatMoney(b.collected, b.currency)}</strong></p>
                  <p>Reste dû : <strong>{formatMoney(b.balance, b.currency)}</strong></p>
                  {b.collection_rate != null && <p>Taux de recouvrement : <strong>{(Number(b.collection_rate) * 100).toFixed(1)} %</strong></p>}
                </CardContent>
              </Card>
            ))}
          </section>
        )}
        <Card>
          <CardHeader><CardTitle>Étudiants par filière</CardTitle><CardDescription>Inscriptions valides, année {year.label}</CardDescription></CardHeader>
          <CardContent>
            {programs.length ? <ProgramChart data={programs} /> : <EmptyState title="Aucune inscription valide pour cette période" />}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Étudiant (ou autre rôle sans rapports)
  const isStudent = access.roles.some((r) => r.code === "student");
  const { data: student } = await supabase.from("students").select("id, matricule, status").eq("user_id", access.userId).maybeSingle();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bonjour, {access.fullName}</h1>
      {isStudent && !student && (
        <Card>
          <CardHeader><CardTitle>Dossier étudiant non rattaché</CardTitle>
            <CardDescription>Votre compte n'est pas encore associé à un matricule. L'administration doit valider ce rattachement.</CardDescription></CardHeader>
        </Card>
      )}
      {student && (
        <section className="grid grid-cols-2 gap-3">
          <KpiCard label="Matricule" value={student.matricule ?? "En attente"} />
          <KpiCard label="Statut" value={student.status} />
        </section>
      )}
      {student && <Button asChild><Link href="/student/invoices">Voir mes factures</Link></Button>}
    </div>
  );
}
