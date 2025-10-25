export const WALLET_MODAL_EVENT = 'rubble:wallet-modal-open';

export function dispatchWalletModalOpen() {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(WALLET_MODAL_EVENT));
}
