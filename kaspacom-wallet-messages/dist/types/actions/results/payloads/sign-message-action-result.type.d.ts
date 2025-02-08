export interface SignedMessageActionResult extends WalletActionResult {
    type: WalletActionResultType.MessageSigning;
    originalMessage: string;
    signedMessage: string;
    publicKey: string;
}
//# sourceMappingURL=sign-message-action-result.type.d.ts.map