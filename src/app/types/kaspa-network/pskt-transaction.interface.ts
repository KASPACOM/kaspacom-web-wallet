export interface PsktTransaction {
    id: string;
    version: number;
    inputs: Array<{
      transactionId: string;
      index: number;
      sequence: string;
      sigOpCount: number;
      signatureScript: string;
      utxo: {
        address: string;
        amount: string;
        scriptPublicKey: string;
        blockDaaScore: string;
        isCoinbase: boolean;
      };
    }>;
    outputs: Array<{
      value: string;
      scriptPublicKey: string;
    }>;
    subnetworkId: string;
    lockTime: string;
    gas: string;
    mass: string;
    payload: string;
  }
  