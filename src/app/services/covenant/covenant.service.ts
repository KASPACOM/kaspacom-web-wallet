import { Injectable } from '@angular/core';
import { RpcService } from '../kaspa-netwrok-services/rpc.service';
import { NetworkConfigService } from '../network-config.service';
import { getCovenantAddress, deployContract, spendContract, getCovenantUtxos, computeCovenantId, buildPartialSpend, completePartialSpend } from './covenant-sdk/covenant';
import { CompiledContract, CovenantOutpoint, CovenantUtxoInfo, SpendOutput, DeployResult, SpendResult, PartiallySignedSpend } from './covenant-sdk/types';

@Injectable({
  providedIn: 'root',
})
export class CovenantService {
  private readonly FALLBACK_RPC_URLS: Record<string, string> = {
    'mainnet': '',  // empty = use Resolver
    'testnet-10': '',
    'testnet-12': 'ws://tn12-node.kaspa.com:17210',
  };

  constructor(
    private readonly rpcService: RpcService,
    private readonly networkConfigService: NetworkConfigService,
  ) { }

  /**
   * Get the wRPC URL for the current network
   */
  private getRpcUrl(): string {
    // Try dynamic config first
    try {
      const activeNetwork = this.networkConfigService.getActiveNetwork();
      if (activeNetwork.wrpcUrl) return activeNetwork.wrpcUrl;
    } catch { }

    // Fallback to hardcoded
    const network = this.rpcService.getNetwork();
    return this.FALLBACK_RPC_URLS[network] || '';
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
  ): Promise<DeployResult> {
    const network = this.rpcService.getNetwork();
    const existingRpc = this.rpcService.getRpc();
    const rpcUrl = this.getRpcUrl();

    console.log('[CovenantService] deploy', {
      network,
      hasExistingRpc: !!existingRpc,
      isConnected: existingRpc?.isConnected,
      rpcUrl,
    });

    // Always try existing RPC first (even if isConnected is uncertain)
    if (existingRpc) {
      try {
        return await deployContract(compiled, amountSompi, '', privateKeyHex, network, existingRpc);
      } catch (err: any) {
        console.warn('[CovenantService] Deploy with existing RPC failed, trying new connection:', err?.message);
      }
    }

    // Fallback: create a new connection with the RPC URL
    return deployContract(compiled, amountSompi, rpcUrl, privateKeyHex, network);
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
  ): Promise<SpendResult> {
    const network = this.rpcService.getNetwork();
    const existingRpc = this.rpcService.getRpc();

    const rpcUrl = this.getRpcUrl();

    if (existingRpc) {
      try {
        return await spendContract(compiled, outpoint, inputAmountSompi, functionName, outputs, '', privateKeyHex, network, existingRpc, covenantId, extraArgs, priorityFee, useSenderFee);
      } catch (err: any) {
        console.warn('[CovenantService] Spend with existing RPC failed, trying new connection:', err?.message);
      }
    }

    return spendContract(compiled, outpoint, inputAmountSompi, functionName, outputs, rpcUrl, privateKeyHex, network, undefined, covenantId, extraArgs, priorityFee, useSenderFee);
  }

  /**
   * Query UTXOs for a deployed covenant, including covenantId metadata
   */
  async queryCovenantUtxos(compiled: CompiledContract): Promise<CovenantUtxoInfo[]> {
    const network = this.rpcService.getNetwork();
    const existingRpc = this.rpcService.getRpc();
    const rpcUrl = this.getRpcUrl();

    if (existingRpc) {
      try {
        return await getCovenantUtxos(compiled, '', network, existingRpc);
      } catch (err: any) {
        console.warn('[CovenantService] queryCovenantUtxos with existing RPC failed:', err?.message);
      }
    }

    return getCovenantUtxos(compiled, rpcUrl, network);
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
    const existingRpc = this.rpcService.getRpc();
    const rpcUrl = this.getRpcUrl();

    if (existingRpc) {
      try {
        return await buildPartialSpend(compiled, functionName, outpoint, inputAmountSompi, outputs, privateKeyHex, network, '', existingRpc);
      } catch (err: any) {
        console.warn('[CovenantService] buildPartial with existing RPC failed:', err?.message);
      }
    }

    return buildPartialSpend(compiled, functionName, outpoint, inputAmountSompi, outputs, privateKeyHex, network, rpcUrl);
  }

  /**
   * Complete a partial spend (Phase 2 of two-phase signing).
   * Adds the remaining signature(s) and broadcasts.
   */
  async completePartial(
    partialSpend: PartiallySignedSpend,
    privateKeyHex: string,
  ): Promise<SpendResult> {
    const existingRpc = this.rpcService.getRpc();
    const rpcUrl = this.getRpcUrl();

    if (existingRpc) {
      try {
        return await completePartialSpend(partialSpend, privateKeyHex, '', existingRpc);
      } catch (err: any) {
        console.warn('[CovenantService] completePartial with existing RPC failed:', err?.message);
      }
    }

    return completePartialSpend(partialSpend, privateKeyHex, rpcUrl);
  }

  /**
   * Parse a compiled contract JSON file
   */
  parseCompiledContract(jsonString: string): CompiledContract {
    return JSON.parse(jsonString) as CompiledContract;
  }
}
