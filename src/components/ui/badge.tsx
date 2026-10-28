import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      neutral: "bg-muted text-foreground",
      success: "bg-success/15 text-success",
      pending: "bg-warning/15 text-warning",
      error: "bg-destructive/15 text-destructive",
      info: "bg-primary/10 text-primary",
    },
  },
  defaultVariants: { variant: "neutral" },
});
export function Badge({ className, variant, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...p} />;
}

// Statuts métier -> couleur (vert confirmé, orange en attente, rouge erreur)
export function statusVariant(status: string): "success" | "pending" | "error" | "info" | "neutral" {
  if (["paid", "confirmed", "success", "valid", "validated", "active", "approved", "published", "accepted"].includes(status)) return "success";
  if (["issued", "partially_paid", "pending", "submitted", "requested", "created", "open"].includes(status)) return "pending";
  if (["failed", "rejected", "cancelled", "revoked", "expired", "suspended"].includes(status)) return "error";
  return "neutral";
}
