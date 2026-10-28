"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/states";
import { Field } from "@/components/brand/field";
import { PasswordInput } from "@/components/brand/password-input";
import { createClient } from "@/lib/supabase/client";
import { resetSchema } from "@/lib/validation/auth";
import type { z } from "zod";

type Values = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ready" | "expired" | "done">("checking");
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(resetSchema) });

  useEffect(() => {
    // La session de récupération est établie par /auth/callback ; sans elle, le lien est invalide ou expiré.
    createClient().auth.getUser().then(({ data }) => setState(data.user ? "ready" : "expired"));
  }, []);

  async function onSubmit(v: Values) {
    const { error } = await createClient().auth.updateUser({ password: v.password });
    if (error) { setError("Impossible de modifier le mot de passe. Demandez un nouveau lien."); return; }
    await createClient().auth.signOut();
    setState("done");
    setTimeout(() => router.replace("/auth/login"), 2500);
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-xl">Nouveau mot de passe</CardTitle></CardHeader>
      <CardContent>
        {state === "checking" && <p className="text-sm text-muted-foreground" role="status">Vérification du lien…</p>}
        {state === "expired" && (
          <div className="space-y-4">
            <ErrorMessage>Ce lien est invalide ou a expiré.</ErrorMessage>
            <Button asChild className="w-full"><Link href="/auth/forgot-password">Demander un nouveau lien</Link></Button>
          </div>
        )}
        {state === "done" && (
          <div className="space-y-2 text-center" role="status">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden />
            <p className="text-sm">Mot de passe modifié. Redirection vers la connexion…</p>
          </div>
        )}
        {state === "ready" && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <Field id="password" label="Nouveau mot de passe" error={errors.password?.message}><PasswordInput id="password" autoComplete="new-password" {...register("password")} /></Field>
            <Field id="confirmPassword" label="Confirmer" error={errors.confirmPassword?.message}><PasswordInput id="confirmPassword" autoComplete="new-password" {...register("confirmPassword")} /></Field>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Enregistrer
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
