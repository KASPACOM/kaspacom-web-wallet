import { EIP1193ProviderResponse, EIP1193RequestType } from "kaspacom-wallet-messages";

export function createEIP1193Response<T extends EIP1193RequestType>(result?: any, error?: { code: number, message: string }): EIP1193ProviderResponse<T> {
    return {
        jsonrpc: '2.0',
        id: 1,
        result: result,
        error: error,
    };
}