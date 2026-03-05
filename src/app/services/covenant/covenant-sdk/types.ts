export interface CompiledContractAstTypeRef {
  base: string;
}

export interface CompiledContractAstParam {
  type_ref: CompiledContractAstTypeRef;
  name: string;
}

export interface CompiledContractAstNode {
  kind: string;
  data: unknown;
}

export interface CompiledContractFunction {
  name: string;
  params: CompiledContractAstParam[];
  entrypoint: boolean;
  return_types: CompiledContractAstTypeRef[];
  body: CompiledContractAstNode[];
}

export interface CompiledContractAst {
  name: string;
  params: CompiledContractAstParam[];
  constants: Record<string, unknown>;
  functions: CompiledContractFunction[];
}

export interface CompiledContractAbiInput {
  name: string;
  type_name: string;
}

export interface CompiledContractAbiEntry {
  name: string;
  inputs: CompiledContractAbiInput[];
}

export interface CompiledContract {
  contract_name: string;
  script: number[];
  ast: CompiledContractAst;
  abi: CompiledContractAbiEntry[];
  without_selector: boolean;
}

export interface CovenantOutpoint {
  txid: string;
  vout: number;
}

export interface SpendOutput {
  address: string;
  amount: bigint;
}

export interface DeployResult {
  txid: string;
  contractAddress: string;
  outpoint: CovenantOutpoint;
  /** Genesis covenant ID (hex) — available when CovenantBinding is attached */
  covenantId?: string;
}

export interface SpendResult {
  txid: string;
  functionName: string;
  /** Covenant ID (hex) — present for continuation spends */
  covenantId?: string;
}

export interface CovenantUtxoInfo {
  outpoint: CovenantOutpoint;
  amount: bigint;
  covenantId?: string;
  blockDaaScore: bigint;
}

// ── Two-Phase Signing (Multi-Party Contracts) ──

export interface PartiallySignedSpend {
  /** Compiled contract JSON (for reconstructing the TX) */
  compiledJson: string;
  /** Function being called */
  functionName: string;
  /** Network identifier */
  network: string;
  /** Covenant outpoint being spent */
  outpoint: CovenantOutpoint;
  /** Input amount in sompi */
  inputAmountSompi: string;
  /** Output addresses and amounts */
  outputs: Array<{ address: string; amountSompi: string }>;
  /** Collected signatures so far (hex, 65 bytes each) */
  signatures: Array<{ paramName: string; signatureHex: string }>;
  /** Which sig params still need signing */
  pendingParams: string[];
  /** Transaction lockTime used */
  lockTime: string;
  /** sigOpCount for the function */
  sigOpCount: number;
}
