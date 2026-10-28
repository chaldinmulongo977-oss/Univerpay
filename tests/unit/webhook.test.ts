import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySaspayWebhook } from "@/server/integrations/saspay/webhook";

const secret = "whsec_test_secret";
const body = JSON.stringify({ event: "transaction.success", data: { id: "tx_1" } });
const sign = (ts: string, b = body) => createHmac("sha256", secret).update(`${ts}.${b}`).digest("hex");
const now = () => String(Math.floor(Date.now() / 1000));

describe("verifySaspayWebhook", () => {
  it("accepte une signature valide", () => {
    const ts = now();
    expect(verifySaspayWebhook(body, sign(ts), ts, secret)).toBe(true);
  });
  it("rejette une signature absente ou fausse", () => {
    const ts = now();
    expect(verifySaspayWebhook(body, null, ts, secret)).toBe(false);
    expect(verifySaspayWebhook(body, "00".repeat(32), ts, secret)).toBe(false);
  });
  it("rejette un corps modifié", () => {
    const ts = now();
    expect(verifySaspayWebhook(body.replace("tx_1", "tx_2"), sign(ts), ts, secret)).toBe(false);
  });
  it("rejette un horodatage trop ancien", () => {
    const ts = String(Math.floor(Date.now() / 1000) - 3600);
    expect(verifySaspayWebhook(body, sign(ts), ts, secret)).toBe(false);
  });
});

import { SaspayError } from "@/server/integrations/saspay/client";

describe("SaspayError", () => {
  it("ne révèle aucun détail technique à l'utilisateur", () => {
    const e = new SaspayError(401, "invalid_key", "SasPay 401 invalid_key: sk_test_secret");
    expect(e.userMessage).not.toContain("sk_test");
    expect(new SaspayError(429, null, "x").userMessage).toContain("Réessayez");
  });
});
