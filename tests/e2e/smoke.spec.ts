import { expect, test } from "@playwright/test";

test("la connexion affiche le champ mot de passe masqué puis visible", async ({ page }) => {
  await page.goto("/auth/login");
  const pwd = page.getByLabel("Mot de passe", { exact: true });
  await expect(pwd).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Afficher le mot de passe" }).click();
  await expect(pwd).toHaveAttribute("type", "text");
});

test("une page privée redirige vers la connexion", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("pas de débordement horizontal sur la page de connexion", async ({ page }) => {
  await page.goto("/auth/login");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
