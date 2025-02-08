import { SignMessageActionInterface } from "../../actions/requests/payloads/sign-message-action.interface";
import { WalletActionTypeEnum } from "../../actions/requests/wallet-action-type.enum";
export type WalletActionResultPayloadInterface = {
    [K in keyof WalletActionResultDataMap]: {
        action: K;
        success: true;
        data: WalletActionResultDataMap[K];
    } | {
        action: K;
        success: false;
        errorCode: number;
    };
}[keyof WalletActionResultDataMap];
interface WalletActionResultDataMap {
    [WalletActionTypeEnum.SignMessage]: SignMessageActionInterface;
}
export {};
//# sourceMappingURL=wallet-action-result-payload-interface.d.ts.map