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
}

export interface SpendResult {
  txid: string;
  functionName: string;
}
