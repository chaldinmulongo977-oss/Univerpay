import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Field } from "@/components/brand/field";
import { requirePermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const metadata = { title: "Facultés et filières" };

const facultySchema = z.object({ code: z.string().trim().min(2).max(12).transform((s) => s.toUpperCase()), name: z.string().trim().min(2).max(120) });
const programSchema = facultySchema.extend({ faculty_id: z.string().uuid() });

// Les écritures passent par le client utilisateur : la RLS (permission org.manage) fait foi.
async function addFaculty(fd: FormData) {
  "use server";
  await requirePermission("org.manage");
  const p = facultySchema.safeParse({ code: fd.get("code"), name: fd.get("name") });
  if (!p.success) return;
  const supabase = await createClient();
  const { data: uni } = await supabase.from("universities").select("id").limit(1).single();
  if (!uni) return;
  await supabase.from("faculties").insert({ university_id: uni.id, ...p.data });
  revalidatePath("/admin/faculties");
}
async function addProgram(fd: FormData) {
  "use server";
  await requirePermission("org.manage");
  const p = programSchema.safeParse({ code: fd.get("code"), name: fd.get("name"), faculty_id: fd.get("faculty_id") });
  if (!p.success) return;
  const supabase = await createClient();
  await supabase.from("programs").insert(p.data);
  revalidatePath("/admin/faculties");
}

export default async function FacultiesPage() {
  await requirePermission("org.manage");
  const supabase = await createClient();
  const { data: faculties } = await supabase.from("faculties").select("id, code, name, programs(id, code, name)").order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Facultés et filières</h1>
      <Card>
        <CardHeader><CardTitle>Ajouter une faculté</CardTitle></CardHeader>
        <CardContent>
          <form action={addFaculty} className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
            <Field id="f-code" label="Code"><Input id="f-code" name="code" required maxLength={12} /></Field>
            <Field id="f-name" label="Nom"><Input id="f-name" name="name" required /></Field>
            <Button type="submit">Ajouter</Button>
          </form>
        </CardContent>
      </Card>
      {!faculties?.length && <EmptyState title="Aucune faculté" />}
      {faculties?.map((f) => (
        <Card key={f.id}>
          <CardHeader><CardTitle>{f.name} <span className="text-sm font-normal text-muted-foreground">({f.code})</span></CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {f.programs.length ? (
              <ul className="divide-y rounded-md border">
                {f.programs.map((p: { id: string; code: string; name: string }) => (
                  <li key={p.id} className="flex justify-between gap-2 p-3 text-sm"><span>{p.name}</span><span className="text-muted-foreground">{p.code}</span></li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Aucune filière.</p>}
            <form action={addProgram} className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
              <input type="hidden" name="faculty_id" value={f.id} />
              <Field id={`p-code-${f.id}`} label="Code filière"><Input id={`p-code-${f.id}`} name="code" required maxLength={12} /></Field>
              <Field id={`p-name-${f.id}`} label="Nom de la filière"><Input id={`p-name-${f.id}`} name="name" required /></Field>
              <Button type="submit" variant="outline">Ajouter la filière</Button>
            </form>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
