"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/brand/field";
import { createClient } from "@/lib/supabase/client";
import { forgotSchema } from "@/lib/validation/auth";
import type { z } from "zod";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });

  async function onSubmit({ email }: z.infer<typeof forgotSchema>) {
    await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });
    setSent(true); // même réponse que l'e-mail existe ou non
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-xl">Mot de passe oublié</CardTitle></CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-4 text-center" role="status">
            <MailCheck className="mx-auto h-10 w-10 text-success" aria-hidden />
            <p className="text-sm">Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé.</p>
            <Button asChild variant="outline" className="w-full"><Link href="/auth/login">Retour à la connexion</Link></Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field id="email" label="Adresse e-mail" error={errors.email?.message}>
              <Input id="email" type="email" autoComplete="email" inputMode="email" {...register("email")} />
            </Field>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Envoyer le lien
            </Button>
            <p className="text-center text-sm"><Link href="/auth/login" className="text-primary underline">Retour à la connexion</Link></p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
