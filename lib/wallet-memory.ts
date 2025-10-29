const REMEMBER_KEY = 'rubble:remember';
const ADDRESS_KEY = 'rubble:address';

export function readRememberFlag(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(REMEMBER_KEY) === '1';
}

export function writeRememberState(address: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REMEMBER_KEY, '1');
  window.localStorage.setItem(ADDRESS_KEY, address);
}

export function clearRememberState() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(REMEMBER_KEY);
  window.localStorage.removeItem(ADDRESS_KEY);
}

export function readRememberedAddress(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ADDRESS_KEY);
}
