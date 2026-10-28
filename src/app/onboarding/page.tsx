"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, GraduationCap, Smartphone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

const SLIDES = [
  { icon: GraduationCap, title: "Une université connectée", text: "Informations académiques, dossiers étudiants et documents centralisés en un seul endroit." },
  { icon: Smartphone, title: "Paiements simplifiés", text: "Consultez vos frais, payez en ligne et retrouvez vos reçus à tout moment." },
  { icon: Users, title: "Un espace personnalisé", text: "Étudiants, parents, facultés, administration et finances : chacun voit ce qui le concerne." },
];

export default function OnboardingPage() {
  const [i, setI] = useState(0);
  const router = useRouter();
  const last = i === SLIDES.length - 1;
  const Icon = SLIDES[i].icon;

  function finish() {
    document.cookie = "unipay_onboarded=1; path=/; max-age=31536000; samesite=lax";
    router.replace("/auth/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col p-6">
      <header className="flex items-center justify-between">
        <Logo size={32} withText />
        {!last && <Button variant="ghost" size="sm" onClick={finish}>Passer</Button>}
      </header>
      <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center" aria-live="polite">
        <div className="flex h-40 w-40 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-20 w-20 text-primary" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold">{SLIDES[i].title}</h1>
        <p className="text-muted-foreground">{SLIDES[i].text}</p>
      </section>
      <div className="mb-4 flex justify-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={SLIDES.length} aria-valuenow={i + 1} aria-label="Progression">
        {SLIDES.map((_, k) => (
          <span key={k} className={`h-2 rounded-full transition-all ${k === i ? "w-8 bg-primary" : "w-2 bg-border"}`} />
        ))}
      </div>
      <nav className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={() => setI(i - 1)} disabled={i === 0}>
          <ChevronLeft className="h-4 w-4" aria-hidden /> Précédent
        </Button>
        {last ? (
          <Button className="flex-1" onClick={finish}>Commencer</Button>
        ) : (
          <Button className="flex-1" onClick={() => setI(i + 1)}>Suivant <ChevronRight className="h-4 w-4" aria-hidden /></Button>
        )}
      </nav>
    </main>
  );
}
