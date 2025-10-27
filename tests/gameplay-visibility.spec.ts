import { test, expect } from '@playwright/test';

test.describe('Rubble gameplay visibility', () => {
  test('canvas visible, sized, and HUD layered', async ({ page }) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000/';
    await page.addInitScript(() => {
      window.localStorage.setItem('rubble:autoplay', 'true');
    });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    const inner = page.locator('.app-frame__inner');
    await expect(inner).toBeVisible();

    const box = await inner.boundingBox();
    expect(box?.width || 0).toBeGreaterThan(100);
    expect(box?.height || 0).toBeGreaterThan(100);

    const canvas = page.locator('canvas.app-canvas');
    await expect(canvas).toBeVisible();

    const hud = page.locator('.app-hud');
    await page.waitForFunction(() => {
      const el = document.querySelector('.app-hud');
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0;
    });
    const hudZ = await hud.evaluate((el) => getComputedStyle(el).zIndex);
    const canvasZ = await canvas.evaluate((el) => getComputedStyle(el).zIndex);
    expect(parseInt(hudZ || '0')).toBeGreaterThan(parseInt(canvasZ || '0'));

    await page.waitForFunction(() => document.getElementById('rubble-root')?.getAttribute('data-playing') === '1');

    const overflowY = await page.evaluate(() => window.getComputedStyle(document.body).overflowY);
    expect(overflowY).toBe('hidden');

    await page.evaluate(() => {
      localStorage.setItem('rubble:diag', 'true');
      location.reload();
    });
    await page.waitForLoadState('domcontentloaded');
    const diag = page.locator('.rbl-diag');
    await expect(diag).toBeVisible();
    const diagText = await diag.textContent();
    console.log('DIAG:', diagText);

    expect(diagText || '').toMatch(/DPR/i);
    expect(diagText || '').toMatch(/CSS/i);
  });

  test('home economy actions render', async ({ page }) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000/';
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /base storm mini-run/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /share/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /copy link/i })).toBeVisible();
    const shopButtons = page.getByRole('button', { name: /buy/i });
    await expect(shopButtons).toHaveCount(3);
    const buttonLabels = await shopButtons.allTextContents();
    for (const label of buttonLabels) {
      expect(label).toMatch(/\$0\.0[1-5]/);
    }
    await expect(page.getByRole('button', { name: /start arcade/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /daily challenge/i })).toBeVisible();
  });
});
