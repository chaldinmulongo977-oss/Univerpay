"use client";
import { useActionState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorMessage } from "@/components/ui/states";
import { Field } from "@/components/brand/field";
import { createInvitation, type InviteState } from "./actions";

type Opt = { id: string; label: string };

export function InviteForm({ roles, faculties }: { roles: (Opt & { scoped: boolean })[]; faculties: Opt[] }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(createInvitation, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      <Field id="email" label="Adresse e-mail"><Input id="email" name="email" type="email" required /></Field>
      <Field id="role_id" label="Rôle">
        <select id="role_id" name="role_id" required className="min-h-11 w-full rounded-md border border-input bg-card px-3">
          {roles.map((r) => <option key={r.id} value={r.id}>{r.label}{r.scoped ? " (faculté requise)" : ""}</option>)}
        </select>
      </Field>
      <Field id="faculty_id" label="Faculté (si le rôle est facultaire)">
        <select id="faculty_id" name="faculty_id" className="min-h-11 w-full rounded-md border border-input bg-card px-3">
          <option value="">Aucune</option>
          {faculties.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </Field>
      <Field id="days" label="Validité (jours)"><Input id="days" name="days" type="number" min={1} max={30} defaultValue={7} required /></Field>
      <Button type="submit" disabled={pending}>Créer l'invitation</Button>
      {state.link && (
        <div className="space-y-2 rounded-md border bg-muted p-3 text-sm" role="status">
          <p className="font-medium">Lien d'invitation (affiché une seule fois) :</p>
          <p className="break-all">{state.link}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(state.link!)}><Copy className="h-4 w-4" aria-hidden /> Copier</Button>
          <p className="text-muted-foreground">L'envoi automatique par e-mail n'est pas encore branché : transmettez ce lien à la personne invitée.</p>
        </div>
      )}
    </form>
  );
}
