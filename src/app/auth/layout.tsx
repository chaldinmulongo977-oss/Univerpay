import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Logo size={56} />
        <p className="text-sm text-muted-foreground">Université Révérend Kim</p>
      </div>
      {children}
    </main>
  );
}
