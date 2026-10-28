import { describe, expect, it } from "vitest";
import { registerSchema, passwordSchema } from "@/lib/validation/auth";
import { safeNext } from "@/lib/utils";
import { generateInvitationToken, hashToken } from "@/server/invitations";

const valid = {
  lastName: "Mulongo", firstName: "Chaldin", email: "a@b.cd", password: "Motdepasse123", confirmPassword: "Motdepasse123", acceptTerms: true as const,
};

describe("inscription", () => {
  it("accepte des données valides", () => expect(registerSchema.safeParse(valid).success).toBe(true));
  it("refuse des mots de passe différents", () =>
    expect(registerSchema.safeParse({ ...valid, confirmPassword: "autre" }).success).toBe(false));
  it("exige l'acceptation des conditions", () =>
    expect(registerSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false));
  it("n'accepte aucun champ rôle (ignoré par le schéma)", () => {
    const r = registerSchema.safeParse({ ...valid, role: "super_admin" });
    expect(r.success && "role" in r.data).toBe(false);
  });
  it("refuse un mot de passe faible", () => expect(passwordSchema.safeParse("court").success).toBe(false));
});

describe("redirection sûre", () => {
  it("bloque les URL externes", () => {
    expect(safeNext("https://evil.test")).toBe("/dashboard");
    expect(safeNext("//evil.test")).toBe("/dashboard");
    expect(safeNext("/student/invoices")).toBe("/student/invoices");
  });
});

describe("jeton d'invitation", () => {
  it("est aléatoire et stocké sous forme de hash", () => {
    const a = generateInvitationToken(); const b = generateInvitationToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toBe(hashToken(a.token));
    expect(a.hash).not.toContain(a.token);
  });
});
