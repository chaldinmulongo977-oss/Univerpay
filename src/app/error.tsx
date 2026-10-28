"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-bold">Une erreur est survenue</h1>
      <p className="text-muted-foreground">Réessayez. Si le problème persiste, contactez l'administration.</p>
      <Button onClick={reset}>Réessayer</Button>
    </main>
  );
}
