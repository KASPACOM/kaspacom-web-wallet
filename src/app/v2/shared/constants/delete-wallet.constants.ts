export const DELETE_ALL_WALLET_CONFIRMATION_PHRASE = 'DELETE MY DATA';


export function isDeleteWalletConfirmationValid(value: string): boolean {
  return value.trim().toUpperCase() === DELETE_ALL_WALLET_CONFIRMATION_PHRASE;
}

