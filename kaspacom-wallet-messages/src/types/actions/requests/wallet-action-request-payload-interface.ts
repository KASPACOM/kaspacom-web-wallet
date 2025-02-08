import { SignMessageActionInterface } from './payloads/sign-message-action.interface';
import { WalletActionTypeEnum } from './wallet-action-type.enum';

export type WalletActionRequestPayloadInterface = {
  [K in keyof WalletActionsDataMap]: {
    action: K;
    data: WalletActionsDataMap[K];
  };
}[keyof WalletActionsDataMap];

interface WalletActionsDataMap {
  [WalletActionTypeEnum.SignMessage]: SignMessageActionInterface;
}
