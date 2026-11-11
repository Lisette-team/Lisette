import { expect, test } from "@playwright/test";

import { createVerifiedUser, deleteUser, localSupabaseAvailable } from "../helpers/local-users";

test.describe("language_persists_and_private_routes_redirect", () => {
  test("Romanian choice survives a reload", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Română" }).click();
    await expect(page.getByRole("button", { name: "Creează contul" })).toBeVisible();

    await page.reload();

    await expect(page.getByRole("button", { name: "Creează contul" })).toBeVisible();
    await expect(page.getByRole("button", { name: "English" })).toHaveCount(0);
  });

  test("signed-out /manuscripts redirects to the start screen", async ({ page }) => {
    await page.goto("/manuscripts");

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: "Română" })).toBeVisible();
  });

  test("a 900px tablet viewport has no clipped primary action", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 1200 });
    await page.goto("/");
    await page.getByRole("button", { name: "English" }).click();

    for (const path of ["/", "/create-account", "/sign-in"]) {
      await page.goto(path);
      const primary = page.getByRole("button", { name: path === "/sign-in" ? "Sign in" : "Create account" }).last();
      await expect(primary).toBeInViewport({ ratio: 1 });
      const box = await primary.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(900);
    }
  });

  test("a verified account signs in and keeps its saved language", async ({ page }) => {
    test.skip(!localSupabaseAvailable, "needs the local Supabase stack (SUPABASE_SERVICE_ROLE_KEY)");
    const user = await createVerifiedUser("en");
    try {
      await page.goto("/");
      await page.getByRole("button", { name: "Română" }).click();
      await page.goto("/sign-in");
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Parolă").fill(user.password);
      await page.getByRole("button", { name: "Intră în cont" }).last().click();

      await expect(page).toHaveURL(/\/manuscripts$/);
      await expect(page.getByText("Manuscripts", { exact: true })).toBeVisible();

      await page.reload();
      await expect(page).toHaveURL(/\/manuscripts$/);
    } finally {
      await deleteUser(user.id);
    }
  });
});
