import crypto from 'node:crypto';
import { ENV } from './env';

const BASE_CHAIN_ID_DECIMAL = 8453;
const BASE_CHAIN_ID_HEX = '0x2105';

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: unknown[];
};

type JsonRpcSuccess<T> = { jsonrpc: '2.0'; id: number; result: T };
type JsonRpcError = { jsonrpc: '2.0'; id: number | null; error: { code?: number; message?: string } };

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcError;

async function callJsonRpc<T>(method: string, params: unknown[] = []): Promise<{ ok: true; result: T } | { ok: false; detail: string }>
{  const request: JsonRpcRequest = { jsonrpc: '2.0', id: Date.now(), method, params };
  let response: Response;
  try {
    response = await fetch(ENV.BASE_RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
      cache: 'no-store',
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Failed to reach Base RPC';
    return { ok: false, detail };
  }

  if (!response.ok) {
    return { ok: false, detail: `RPC HTTP ${response.status}` };
  }

  let payload: JsonRpcResponse<T>;
  try {
    payload = (await response.json()) as JsonRpcResponse<T>;
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Unable to parse RPC response';
    return { ok: false, detail };
  }

  if ('error' in payload) {
    const detail = payload.error?.message ?? 'RPC returned an error';
    return { ok: false, detail };
  }

  return { ok: true, result: payload.result };
}

function toHex(value: bigint) {
  return `0x${value.toString(16)}`;
}

function parseWeiInput(value: unknown): bigint | null {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      return BigInt(value.trim());
    } catch {
      return null;
    }
  }
  return null;
}

type NativePaymentInput = {
  amountWei: unknown;
  to: string;
  memo?: string;
};

type NativePaymentIntent = {
  to: string;
  value: string;
  valueHex: string;
  chainId: typeof BASE_CHAIN_ID_DECIMAL;
  chainIdHex: typeof BASE_CHAIN_ID_HEX;
  type: '0x2';
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  memo?: string;
};

type NativePaymentSuccess = { ok: true; intent: NativePaymentIntent };
type NativePaymentFailure = { ok: false; code: 'BAD_REQUEST'; detail: string };

export type NativePaymentResult = NativePaymentSuccess | NativePaymentFailure;

export async function createPaymentNativeBase({ amountWei, to, memo }: NativePaymentInput): Promise<NativePaymentResult> {
  const normalisedTo = to.trim();
  if (!/^0x[a-fA-F0-9]{40}$/u.test(normalisedTo)) {
    return { ok: false, code: 'BAD_REQUEST', detail: 'Recipient must be a valid 0x address' };
  }

  const parsedAmount = parseWeiInput(amountWei);
  if (parsedAmount === null) {
    return { ok: false, code: 'BAD_REQUEST', detail: 'Amount must be provided in wei' };
  }

  if (parsedAmount < ENV.MIN_PRICE_WEI) {
    return {
      ok: false,
      code: 'BAD_REQUEST',
      detail: `Amount is below minimum price of ${ENV.MIN_PRICE_WEI.toString()} wei`,
    };
  }

  const shouldBypassRpc = ENV.BASE_PAY_MOCK === '1';
  const feeResult = shouldBypassRpc
    ? undefined
    : await callJsonRpc<string>('eth_gasPrice');

  let maxFeePerGas: string | undefined;
  let maxPriorityFeePerGas: string | undefined;

  if (feeResult?.ok) {
    try {
      const gasPrice = BigInt(feeResult.result);
      const priority = gasPrice;
      const maxFee = gasPrice * 2n;
      maxPriorityFeePerGas = toHex(priority);
      maxFeePerGas = toHex(maxFee);
    } catch {
      maxFeePerGas = feeResult.result;
      maxPriorityFeePerGas = feeResult.result;
    }
  }

  return {
    ok: true,
    intent: {
      to: normalisedTo,
      value: parsedAmount.toString(),
      valueHex: toHex(parsedAmount),
      chainId: BASE_CHAIN_ID_DECIMAL,
      chainIdHex: BASE_CHAIN_ID_HEX,
      type: '0x2',
      maxFeePerGas,
      maxPriorityFeePerGas,
      memo,
    },
  };
}

type CommercePaymentInput = {
  sku: string;
  amountWei: bigint;
};

type CommercePaymentSuccess = { ok: true; session: unknown };
type CommercePaymentFailure =
  | { ok: false; code: 'MODE_B_DISABLED' }
  | { ok: false; code: 'FETCH_ERROR'; detail: string }
  | { ok: false; code: 'API_NON_2XX'; status: number; detail?: string };

export type CommercePaymentResult = CommercePaymentSuccess | CommercePaymentFailure;

function normaliseBaseUrl(value: string) {
  return value.replace(/\/$/, '');
}

export async function createPaymentCommerce({ sku, amountWei }: CommercePaymentInput): Promise<CommercePaymentResult> {
  if (!ENV.PAYMENTS_MODE_B_ENABLED) {
    return { ok: false, code: 'MODE_B_DISABLED' };
  }

  if (ENV.BASE_PAY_MOCK === '1') {
    return {
      ok: true,
      session: {
        id: `mock_${Date.now()}`,
        mock: true,
        sku,
        amountWei: amountWei.toString(),
      },
    } satisfies CommercePaymentSuccess;
  }

  const apiBase = ENV.PAYMENTS_API_BASE;
  const apiKeyId = ENV.PAYMENTS_API_KEY_ID;
  const apiSecret = ENV.PAYMENTS_API_SECRET;

  if (!apiBase || !apiKeyId || !apiSecret) {
    return { ok: false, code: 'MODE_B_DISABLED' };
  }

  const endpoint = `${normaliseBaseUrl(apiBase)}/sessions`;

  const body = {
    sku,
    amount: {
      currency: 'wei',
      value: amountWei.toString(),
    },
    chainId: BASE_CHAIN_ID_DECIMAL,
    payToAddress: ENV.PAY_TO_ADDRESS,
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-key-id': apiKeyId,
        'x-api-key-secret': apiSecret,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Failed to reach payments API';
    return { ok: false, code: 'FETCH_ERROR', detail };
  }

  if (!response.ok) {
    let detail: string | undefined;
    try {
      detail = await response.text();
    } catch (error: unknown) {
      detail = error instanceof Error ? error.message : undefined;
    }
    return { ok: false, code: 'API_NON_2XX', status: response.status, detail };
  }

  try {
    const session = await response.json();
    return { ok: true, session } satisfies CommercePaymentSuccess;
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Failed to parse payments API response';
    return { ok: false, code: 'FETCH_ERROR', detail };
  }
}

type CommerceWebhookSuccess = { ok: true; event: unknown };
type CommerceWebhookFailure =
  | { ok: false; code: 'MODE_B_DISABLED' }
  | { ok: false; code: 'BAD_SIGNATURE'; detail?: string };

export type CommerceWebhookResult = CommerceWebhookSuccess | CommerceWebhookFailure;

function decodeSignature(signature: string) {
  const trimmed = signature.trim();
  if (!trimmed) {
    return null;
  }
  if (/^[0-9a-fA-F]+$/u.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, 'hex');
  }
  try {
    return Buffer.from(trimmed, 'base64');
  } catch {
    return null;
  }
}

function timingSafeEqual(expected: Buffer, provided: Buffer) {
  if (expected.length !== provided.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, provided);
}

export async function verifyCommerceWebhook(rawBody: string, signatureHeader: string | null | undefined): Promise<CommerceWebhookResult> {
  if (!ENV.PAYMENTS_MODE_B_ENABLED) {
    return { ok: false, code: 'MODE_B_DISABLED' };
  }

  const secret = ENV.PAYMENTS_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, code: 'MODE_B_DISABLED' };
  }

  const signature = signatureHeader ?? '';
  const payloadBuffer = Buffer.from(rawBody, 'utf8');
  const expected = crypto.createHmac('sha256', secret).update(payloadBuffer).digest();

  const provided = decodeSignature(signature);
  if (!provided) {
    return { ok: false, code: 'BAD_SIGNATURE', detail: 'Signature missing or malformed' };
  }

  if (!timingSafeEqual(expected, provided)) {
    return { ok: false, code: 'BAD_SIGNATURE', detail: 'Signature verification failed' };
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody) as unknown;
  } catch {
    return { ok: false, code: 'BAD_SIGNATURE', detail: 'Webhook payload was not valid JSON' };
  }

  return { ok: true, event } satisfies CommerceWebhookSuccess;
}
