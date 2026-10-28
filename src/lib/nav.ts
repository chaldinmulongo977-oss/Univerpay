import { Banknote, Building2, FileText, GraduationCap, LayoutDashboard, ReceiptText, ShieldCheck, Users, Wallet } from "lucide-react";

export type NavItem = { href: string; label: string; icon: typeof Users; permission?: string; role?: string };

// Visibilité de confort uniquement : chaque page et chaque API revérifie côté serveur.
export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/student/invoices", label: "Mes factures", icon: FileText, role: "student" },
  { href: "/finance", label: "Finances", icon: Wallet, permission: "payments.read" },
  { href: "/admin/faculties", label: "Facultés et filières", icon: Building2, permission: "org.manage" },
  { href: "/admin/users", label: "Utilisateurs et invitations", icon: ShieldCheck, permission: "users.manage" },
];
export { Banknote, GraduationCap, ReceiptText };
