"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { NAV } from "@/lib/nav";

type Props = { name: string; permissions: string[]; roles: string[]; signOut: () => Promise<void>; children: React.ReactNode };

export function AppShell({ name, permissions, roles, signOut, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = NAV.filter((n) => (!n.permission || permissions.includes(n.permission)) && (!n.role || roles.includes(n.role)));

  const nav = (
    <nav aria-label="Navigation principale" className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href} href={href} onClick={() => setOpen(false)}
          aria-current={pathname === href ? "page" : undefined}
          className={cn("flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium hover:bg-muted", pathname === href && "bg-primary/10 text-primary")}
        >
          <Icon className="h-5 w-5" aria-hidden /> {label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="no-print hidden border-r bg-card p-4 lg:block">
        <div className="mb-6"><Logo size={36} withText /></div>
        {nav}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu"><Menu className="h-5 w-5" /></Button>
            <span className="lg:hidden"><Logo size={28} /></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm sm:inline">{name}</span>
            <form action={signOut}>
              <Button variant="outline" size="sm" type="submit"><LogOut className="h-4 w-4" aria-hidden /> Déconnexion</Button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-3 sm:p-6">{children}</main>
      </div>

      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/40" aria-label="Fermer le menu" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-card p-4 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <Logo size={32} withText />
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fermer"><X className="h-5 w-5" /></Button>
            </div>
            {nav}
          </div>
        </div>
      )}
    </div>
  );
}
