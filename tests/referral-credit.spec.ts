import { test, expect } from '@playwright/test';
import { initWalletStub, MOCK_ADDRESS } from './utils/wallet';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';
const INVITER_ADDRESS = '0x1111111111111111111111111111111111111111';

test.describe('referral credit', () => {
  test('awards once and dedupes subsequent claims', async ({ page }) => {
    await initWalletStub(page);
    await page.goto(`${BASE_URL}?ref=${INVITER_ADDRESS}`, { waitUntil: 'domcontentloaded' });

    const connectButton = page.getByTestId('connect-wallet-home');
    if (await connectButton.isVisible()) {
      await connectButton.click();
    }

    const firstClaim = await page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/referral/claim') && response.request().method() === 'POST'
    );
    const firstJson = (await firstClaim.json()) as { ok: boolean; reward?: { type: string; amount: number } };
    expect(firstJson.ok).toBeTruthy();
    expect(firstJson.reward).toBeDefined();

    const duplicateResponse = await page.request.post('/api/referral/claim', {
      data: { inviterAddress: INVITER_ADDRESS, inviteeAddress: MOCK_ADDRESS },
    });
    const duplicateJson = (await duplicateResponse.json()) as { ok: boolean; duplicate?: boolean };
    expect(duplicateJson.duplicate).toBeTruthy();
  });
});
