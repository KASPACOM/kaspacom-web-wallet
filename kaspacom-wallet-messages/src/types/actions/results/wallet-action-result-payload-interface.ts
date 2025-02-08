import { WalletActionTypeEnum } from "../requests/wallet-action-type.enum";
import { SignedMessageActionResult } from "./payloads/sign-message-action-result.interface";

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
  [WalletActionTypeEnum.SignMessage]: SignedMessageActionResult;
}
