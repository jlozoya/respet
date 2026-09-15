import { expect, test } from '@playwright/test';

test.describe('arranque de la aplicación', () => {
  test('muestra el muro a un visitante', async ({ page }) => {
    await page.goto('/');

    // El muro es la portada: entrar en la aplicación es entrar en él, sin un
    // salto intermedio a otra dirección.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('app-post-card').first()).toBeVisible();
  });

  test('lleva al inicio de sesión desde una ruta protegida', async ({ page }) => {
    await page.goto('/account');

    await expect(page).toHaveURL(/\/login/);
  });
});
