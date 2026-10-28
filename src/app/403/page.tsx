import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function Forbidden() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <ShieldAlert className="h-12 w-12 text-warning" aria-hidden />
      <h1 className="text-xl font-bold">Accès refusé</h1>
      <p className="text-muted-foreground">Vous n'avez pas les droits nécessaires pour consulter cette page.</p>
      <Button asChild><Link href="/dashboard">Retour au tableau de bord</Link></Button>
    </main>
  );
}
