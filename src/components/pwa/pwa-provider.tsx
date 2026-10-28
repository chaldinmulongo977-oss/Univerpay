"use client";
import { useEffect, useState } from "react";
import { Download, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & { prompt: () => Promise<void> };

export function PwaProvider() {
  const [online, setOnline] = useState(true);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const beforeInstall = (e: Event) => { e.preventDefault(); setInstallEvent(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", beforeInstall);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        if (reg.waiting) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          sw?.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
          });
        });
      });
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!reloaded) { reloaded = true; window.location.reload(); }
      });
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
    };
  }, []);

  return (
    <div className="no-print">
      {!online && (
        <div role="status" className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-warning px-3 py-2 text-sm text-warning-foreground">
          <WifiOff className="h-4 w-4" aria-hidden /> Connexion perdue. Les paiements sont indisponibles hors ligne.
        </div>
      )}
      {(installEvent || waiting) && (
        <div className="fixed inset-x-3 bottom-3 z-50 flex items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-lg sm:left-auto sm:max-w-sm">
          {waiting ? (
            <>
              <span className="text-sm">Une nouvelle version est disponible.</span>
              <Button size="sm" onClick={() => waiting.postMessage("SKIP_WAITING")}>
                <RefreshCw className="h-4 w-4" aria-hidden /> Mettre à jour
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm">Installer UniPay sur cet appareil</span>
              <Button size="sm" onClick={async () => { await installEvent?.prompt(); setInstallEvent(null); }}>
                <Download className="h-4 w-4" aria-hidden /> Installer
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
