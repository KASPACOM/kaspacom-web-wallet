import { Injectable } from '@angular/core';
import { RpcService } from '../kaspa-netwrok-services/rpc.service';
import { getCovenantAddress, deployContract, spendContract, getCovenantUtxos, buildPartialSpend, completePartialSpend } from './covenant-sdk/covenant';
import { CompiledContract, CovenantOutpoint, CovenantUtxoInfo, SpendOutput, DeployResult, SpendResult, PartiallySignedSpend } from './covenant-sdk/types';

@Injectable({
  providedIn: 'root',
})
export class CovenantService {
  constructor(
    private readonly rpcService: RpcService,
  ) { }

  private getManagedRpc() {
    const rpc = this.rpcService.getRpc();
    if (!rpc) {
      throw new Error('RPC is not available. Connect the wallet before using covenants.');
    }

    return rpc;
  }

  /**
   * Get the P2SH address for a compiled contract
   */
  getContractAddress(compiled: CompiledContract): string {
    const network = this.rpcService.getNetwork();
    return getCovenantAddress(compiled, network);
  }

  /**
   * Deploy a contract — locks KAS into a covenant UTXO
   */
  async deploy(
    compiled: CompiledContract,
    amountSompi: bigint,
    privateKeyHex: string,
    priorityFee: bigint = 0n,
  ): Promise<DeployResult> {
    const network = this.rpcService.getNetwork();
    return deployContract(compiled, amountSompi, privateKeyHex, network, this.getManagedRpc(), priorityFee);
  }

  /**
   * Spend a contract — call an entrypoint function
   */
  async spend(
    compiled: CompiledContract,
    outpoint: CovenantOutpoint,
    inputAmountSompi: bigint,
    functionName: string,
    outputs: SpendOutput[],
    privateKeyHex: string,
    extraArgs?: Record<string, bigint>,
    covenantId?: string,
    priorityFee: bigint = 0n,
    useSenderFee: boolean = false,
    transactionPayloadHex?: string,
  ): Promise<SpendResult> {
    const network = this.rpcService.getNetwork();
    return spendContract(compiled, outpoint, inputAmountSompi, functionName, outputs, privateKeyHex, network, this.getManagedRpc(), covenantId, extraArgs, priorityFee, useSenderFee, transactionPayloadHex);
  }

  /**
   * Query UTXOs for a deployed covenant, including covenantId metadata
   */
  async queryCovenantUtxos(compiled: CompiledContract): Promise<CovenantUtxoInfo[]> {
    const network = this.rpcService.getNetwork();
    return getCovenantUtxos(compiled, network, this.getManagedRpc());
  }

  /**
   * Build a partial spend (Phase 1 of two-phase signing).
   * Signs with the local key and returns a serializable object for the co-signer.
   */
  async buildPartial(
    compiled: CompiledContract,
    functionName: string,
    outpoint: CovenantOutpoint,
    inputAmountSompi: bigint,
    outputs: SpendOutput[],
    privateKeyHex: string,
  ): Promise<PartiallySignedSpend> {
    const network = this.rpcService.getNetwork();
    return buildPartialSpend(compiled, functionName, outpoint, inputAmountSompi, outputs, privateKeyHex, network, this.getManagedRpc());
  }

  /**
   * Complete a partial spend (Phase 2 of two-phase signing).
   * Adds the remaining signature(s) and broadcasts.
   */
  async completePartial(
    partialSpend: PartiallySignedSpend,
    privateKeyHex: string,
  ): Promise<SpendResult> {
    return completePartialSpend(partialSpend, privateKeyHex, this.getManagedRpc());
  }

  /**
   * Parse a compiled contract JSON file
   */
  parseCompiledContract(jsonString: string): CompiledContract {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid compiled contract: not valid JSON');
    }

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray(parsed.script) ||
      !Array.isArray(parsed.abi) ||
      typeof parsed.ast !== 'object' ||
      parsed.ast === null
    ) {
      throw new Error('Invalid compiled contract: missing script/abi/ast');
    }

    return parsed as CompiledContract;
  }
}
