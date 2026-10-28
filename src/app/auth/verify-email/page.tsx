import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function VerifyEmailPage() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-xl">Vérifiez votre e-mail</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-center">
        <MailCheck className="mx-auto h-10 w-10 text-primary" aria-hidden />
        <p className="text-sm">Un lien de confirmation vous a été envoyé. Ouvrez-le pour activer votre compte.</p>
        <Button asChild variant="outline" className="w-full"><Link href="/auth/login">Retour à la connexion</Link></Button>
      </CardContent>
    </Card>
  );
}
