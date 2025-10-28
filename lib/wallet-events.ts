export const WALLET_MODAL_EVENT = 'bubbleit:wallet-modal-open';

export function dispatchWalletModalOpen() {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(WALLET_MODAL_EVENT));
}
