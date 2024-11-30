export interface KRC20OperationDataInterface {
    p: 'krc-20';
    op: 'mint' | 'deploy' | 'transfer';
    tick: string;
    to?: string;
    amt?: string;
    max?: string;
    lim?: string;
    dec?: '8';
    pre?: string;
  }