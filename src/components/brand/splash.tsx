"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/logo";

// Limité dans le temps (1,2 s) ; le cookie de session décide, pas le navigateur.
export function Splash({ destination }: { destination: string }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace(destination), 1200);
    return () => clearTimeout(t);
  }, [destination, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-primary p-6 text-primary-foreground" aria-busy="true">
      <div className="animate-pulse rounded-3xl bg-white p-3">
        <Logo size={88} />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">UniPay</h1>
      <p className="text-sm opacity-90">Université Révérend Kim</p>
      <div className="mt-4 h-1 w-28 overflow-hidden rounded-full bg-white/30" role="status" aria-label="Chargement">
        <div className="h-full w-1/2 animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-white" />
      </div>
    </main>
  );
}
