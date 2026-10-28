"use client";
import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/states";

// Le montant n'est qu'une demande : le serveur le revérifie contre le solde réel de la facture.
export function PayButton({ invoiceId, balance, allowsPartial }: { invoiceId: string; balance: number; allowsPartial: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState("");

  async function pay() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, amount: partial ? partial : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Paiement indisponible");
      window.location.href = json.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Paiement indisponible");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {allowsPartial && balance > 0 && (
        <input
          type="number" inputMode="decimal" min="0" step="0.01" max={balance} value={partial}
          onChange={(e) => setPartial(e.target.value)} aria-label="Montant partiel (laisser vide pour payer le solde)"
          placeholder="Montant partiel (facultatif)" className="min-h-11 w-full rounded-md border border-input bg-card px-3"
        />
      )}
      <Button onClick={pay} disabled={busy || (typeof navigator !== "undefined" && !navigator.onLine)} className="w-full sm:w-auto">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CreditCard className="h-4 w-4" aria-hidden />} Payer
      </Button>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  );
}
