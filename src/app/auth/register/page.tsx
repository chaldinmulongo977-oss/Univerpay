"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(v: RegisterInput) {
    setError(null);
    // Aucun champ « rôle » n'existe : la base attribue « student » par un déclencheur serveur.
    const { data, error } = await createClient().auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { last_name: v.lastName, middle_name: v.middleName ?? null, first_name: v.firstName, phone: v.phone ?? null },
      },
    });
    if (error) { setError("Inscription impossible. Vérifiez vos informations ou connectez-vous si vous avez déjà un compte."); return; }
    if (data.session) { router.replace("/dashboard"); router.refresh(); return; }
    router.replace("/auth/verify-email");
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-xl">Créer un compte</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <Field id="lastName" label="Nom" error={errors.lastName?.message}><Input id="lastName" autoComplete="family-name" {...register("lastName")} /></Field>
          <Field id="middleName" label="Postnom (facultatif)" error={errors.middleName?.message}><Input id="middleName" {...register("middleName")} /></Field>
          <Field id="firstName" label="Prénom" error={errors.firstName?.message}><Input id="firstName" autoComplete="given-name" {...register("firstName")} /></Field>
          <Field id="email" label="Adresse e-mail" error={errors.email?.message}><Input id="email" type="email" autoComplete="email" inputMode="email" {...register("email")} /></Field>
          <Field id="phone" label="Téléphone (facultatif)" error={errors.phone?.message}><Input id="phone" type="tel" autoComplete="tel" inputMode="tel" {...register("phone")} /></Field>
          <Field id="password" label="Mot de passe" error={errors.password?.message}><PasswordInput id="password" autoComplete="new-password" {...register("password")} /></Field>
          <Field id="confirmPassword" label="Confirmer le mot de passe" error={errors.confirmPassword?.message}><PasswordInput id="confirmPassword" autoComplete="new-password" {...register("confirmPassword")} /></Field>
          <div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-5 w-5" {...register("acceptTerms")} />
              <span>J'accepte les conditions d'utilisation et la politique de confidentialité.</span>
            </label>
            {errors.acceptTerms && <p className="mt-1 text-sm text-destructive">{errors.acceptTerms.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Créer mon compte
          </Button>
          <p className="text-center text-sm">Déjà inscrit ? <Link href="/auth/login" className="text-primary underline">Se connecter</Link></p>
        </form>
      </CardContent>
    </Card>
  );
}
