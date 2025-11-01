export type ReferralReward = {
  type: 'boost' | 'bubbles';
  amount: number;
};

export type ReferralClaimResponse = {
  ok: boolean;
  reward?: ReferralReward;
  duplicate?: boolean;
  error?: string;
};

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function claimReferralReward(inviterAddress: string, inviteeAddress: string): Promise<ReferralClaimResponse> {
  try {
    const response = await fetch('/api/referral/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ inviterAddress, inviteeAddress }),
    });
    const payload = (await parseJson<ReferralClaimResponse>(response)) ?? { ok: false, error: 'invalid_response' };
    if (!response.ok && !payload.error) {
      payload.error = `http_${response.status}`;
    }
    return payload;
  } catch {
    return { ok: false, error: 'network_error' };
  }
}
