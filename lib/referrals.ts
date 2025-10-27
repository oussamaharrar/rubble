function toBase64Url(value: string) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
  }
  if (typeof btoa !== 'undefined') {
    return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
  }
  return value;
}

function fromBase64Url(value: string) {
  const normalised = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalised + '==='.slice((normalised.length + 3) % 4);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf8');
  }
  if (typeof atob !== 'undefined') {
    return atob(padded);
  }
  return value;
}

export function encodeReferralCode(address: string) {
  const trimmed = address.trim().toLowerCase();
  const withoutPrefix = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
  return toBase64Url(withoutPrefix);
}

export function decodeReferralCode(code: string) {
  if (!code) return null;
  try {
    const decoded = fromBase64Url(code.trim());
    if (!/^[0-9a-f]{40}$/u.test(decoded)) {
      return null;
    }
    return (`0x${decoded}`) as `0x${string}`;
  } catch {
    return null;
  }
}

export function makeReferralUrl(baseUrl: string, code: string) {
  const url = new URL(baseUrl);
  url.searchParams.set('ref', code);
  return url.toString();
}
