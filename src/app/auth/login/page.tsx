"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorMessage } from "@/components/ui/states";
import { Field } from "@/components/brand/field";
import { PasswordInput } from "@/components/brand/password-input";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validation/auth";
import { safeNext } from "@/lib/utils";
import type { z } from "zod";

type Values = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(params.get("error") ? "Connexion impossible. Réessayez." : null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: Values) {
    setError(null);
    const { error } = await createClient().auth.signInWithPassword(values);
    if (error) {
      // Message volontairement générique : ne révèle pas si l'e-mail existe.
      setError(error.message.toLowerCase().includes("confirm") ? "Veuillez d'abord confirmer votre adresse e-mail." : "E-mail ou mot de passe incorrect.");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function google() {
    setGoogleBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) { setError("Connexion Google indisponible."); setGoogleBusy(false); }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-xl">Connexion</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <Field id="email" label="Adresse e-mail" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!errors.email} {...register("email")} />
          </Field>
          <Field id="password" label="Mot de passe" error={errors.password?.message}>
            <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register("password")} />
          </Field>
          <div className="text-right text-sm"><Link href="/auth/forgot-password" className="text-primary underline">Mot de passe oublié ?</Link></div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Se connecter
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={google} disabled={googleBusy}>
            {googleBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Continuer avec Google
          </Button>
          <p className="text-center text-sm">Pas de compte ? <Link href="/auth/register" className="text-primary underline">Créer un compte</Link></p>
        </form>
      </CardContent>
    </Card>
  );
}
export default function LoginPage() { return <Suspense><LoginForm /></Suspense>; }
