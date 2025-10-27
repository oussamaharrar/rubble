import { test, expect } from '@playwright/test';

async function dismissHomeTutorial(page: import('@playwright/test').Page) {
  const tutorial = page.locator('text=Rubble tutorial');
  if (await tutorial.first().isVisible()) {
    const skip = page.getByRole('button', { name: 'Skip', exact: true });
    await skip.click();
  }
}

async function startRun(page: import('@playwright/test').Page) {
  await dismissHomeTutorial(page);
  await page.waitForFunction(() => typeof window !== 'undefined' && Boolean((window as any).__rubbleTest), {
    timeout: 10_000,
  });

  await page.evaluate(() => {
    const api = (window as typeof window & {
      __rubbleTest?: {
        start: (mode?: string) => void;
        begin: () => void;
      };
    }).__rubbleTest;
    api?.start('trial');
    api?.begin();
  });

  await page.waitForTimeout(100);

  await page.locator('#rubble-root[data-playing="1"]').waitFor({ state: 'attached' });
  const canvas = page.locator('canvas.app-canvas');
  await expect(canvas).toBeVisible();
  return canvas;
}

test.describe('Rubble gameplay visibility', () => {
  test('canvas visible, sized, and HUD layered', async ({ page }) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000/';
    await page.addInitScript(() => {
      const ethereum = {
        async request({ method }: { method: string }) {
          if (method === 'eth_requestAccounts') {
            return ['0x1234567890abcdef1234567890abcdef12345678'];
          }
          if (method === 'eth_accounts') {
            return ['0x1234567890abcdef1234567890abcdef12345678'];
          }
          if (method === 'eth_chainId') {
            return '0x2105';
          }
          return null;
        },
      };
      Object.defineProperty(window, 'ethereum', {
        value: ethereum,
        configurable: true,
      });
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith('trial_used_'))
        .forEach((key) => window.localStorage.removeItem(key));
      window.localStorage.setItem('rubble:tutorial-pref', JSON.stringify({ dismissed: true }));
    });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    const inner = page.locator('.app-frame__inner');
    await expect(inner).toBeVisible();

    await startRun(page);

    const box = await inner.boundingBox();
    expect(box?.width || 0).toBeGreaterThan(100);
    expect(box?.height || 0).toBeGreaterThan(100);

    const canvas = page.locator('canvas.app-canvas');

    const hud = page.locator('.app-hud');
    const pauseButton = page.getByRole('button', { name: 'Pause run' });
    await expect(pauseButton).toBeVisible({ timeout: 10000 });
    const hudZ = await hud.evaluate((el) => getComputedStyle(el).zIndex);
    const canvasZ = await canvas.evaluate((el) => getComputedStyle(el).zIndex);
    expect(parseInt(hudZ || '0', 10)).toBeGreaterThan(parseInt(canvasZ || '0', 10));

    const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflowY);
    expect(['hidden', 'clip']).toContain(bodyOverflow);

    await page.evaluate(() => {
      localStorage.setItem('rubble:diag', 'true');
      location.reload();
    });
    await page.waitForLoadState('domcontentloaded');
    await startRun(page);
    const diag = page.locator('.rbl-diag');
    await expect(diag).toBeVisible();
    const diagText = await diag.textContent();
    console.log('DIAG:', diagText);

    expect(diagText || '').toMatch(/DPR/i);
    expect(diagText || '').toMatch(/CSS/i);
  });
});
