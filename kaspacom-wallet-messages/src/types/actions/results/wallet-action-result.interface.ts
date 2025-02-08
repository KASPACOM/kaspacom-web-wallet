import { WalletActionResultType } from "./wallet-action-result-type.enum";

export interface WalletActionResult {
  performedByWallet: string;
  type: WalletActionResultType;
}
