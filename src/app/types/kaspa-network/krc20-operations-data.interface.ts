/**
 * Interface representing the data structure for KRC20 operations.
 */
export interface KRC20OperationDataInterface {
  /** Protocol identifier, always 'krc-20' */
  p: 'krc-20';
  
  /** Operation type (e.g., MINT, DEPLOY, TRANSFER) */
  op: KRC20OperationType;
  
  /** Ticker symbol for the token */
  tick: string;
  
  /** Optional recipient address for transfer operations */
  to?: string;
  
  /** Optional amount for transfer operations, represented as a string */
  amt?: string;
  
  /** Optional maximum supply for deploy operations, represented as a string */
  max?: string;
  
  /** Optional limit for deploy operations, represented as a string */
  lim?: string;
  
  /** Optional decimal places, always '8' */
  dec?: '8';
  
  /** Optional pre tokens release value for deploy */
  pre?: string;
}

  export enum KRC20OperationType {
    MINT = 'mint',
    DEPLOY = 'deploy',
    TRANSFER = 'transfer',
  }
  