import { WalletActionResultType } from '../wallet-action-result-type.enum';
import { WalletActionResult } from '../wallet-action-result.interface';
export interface SignedMessageActionResult extends WalletActionResult {
    type: WalletActionResultType.MessageSigning;
    originalMessage: string;
    signedMessage: string;
    publicKey: string;
}
//# sourceMappingURL=sign-message-action-result.interface.d.ts.map