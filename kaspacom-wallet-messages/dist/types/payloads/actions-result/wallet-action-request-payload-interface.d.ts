export type WalletActionRequestPayloadInterface = {
    [K in keyof WalletActionsDataMap]: {
        action: K;
        data: WalletActionsDataMap[K];
    };
}[keyof WalletActionsDataMap];
interface WalletActionsDataMap {
}
export {};
//# sourceMappingURL=wallet-action-request-payload-interface.d.ts.map