import { Ban } from "lucide-react";
export default function AccountDisabled() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <Ban className="h-12 w-12 text-destructive" aria-hidden />
      <h1 className="text-xl font-bold">Compte désactivé</h1>
      <p className="text-muted-foreground">Votre accès a été suspendu. Contactez l'administration de l'Université Révérend Kim.</p>
    </main>
  );
}
