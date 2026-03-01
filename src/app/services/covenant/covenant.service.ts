import { Injectable } from '@angular/core';
import { RpcService } from '../kaspa-netwrok-services/rpc.service';
import { getCovenantAddress, deployContract, spendContract } from './covenant-sdk/covenant';
import { CompiledContract, CovenantOutpoint, SpendOutput, DeployResult, SpendResult } from './covenant-sdk/types';

@Injectable({
  providedIn: 'root',
})
export class CovenantService {
  // Default wRPC URLs for different networks
  private readonly DEFAULT_RPC_URLS: Record<string, string> = {
    'mainnet': 'wss://wrpc.kaspa.org',
    'testnet-10': 'wss://testnet-10.kaspa.org:17110',
    'testnet-12': 'wss://tn12-node.kaspa.com:17210',
  };

  constructor(
    private readonly rpcService: RpcService,
  ) {}

  /**
   * Get the wRPC URL for the current network
   */
  private getRpcUrl(): string {
    const network = this.rpcService.getNetwork();
    const url = this.DEFAULT_RPC_URLS[network];
    if (!url) {
      throw new Error(`No default RPC URL configured for network: ${network}`);
    }
    return url;
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
    const rpcUrl = this.getRpcUrl();

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
  ): Promise<SpendResult> {
    const network = this.rpcService.getNetwork();
    const rpcUrl = this.getRpcUrl();

    return spendContract(compiled, outpoint, inputAmountSompi, functionName, outputs, rpcUrl, privateKeyHex, network);
  }

  /**
   * Parse a compiled contract JSON file
   */
  parseCompiledContract(jsonString: string): CompiledContract {
    return JSON.parse(jsonString) as CompiledContract;
  }
}
