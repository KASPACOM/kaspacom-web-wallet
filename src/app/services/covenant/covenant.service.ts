import { Injectable } from '@angular/core';
import { RpcService } from '../kaspa-netwrok-services/rpc.service';
import { NetworkConfigService } from '../network-config.service';
import { getCovenantAddress, deployContract, spendContract } from './covenant-sdk/covenant';
import { CompiledContract, CovenantOutpoint, SpendOutput, DeployResult, SpendResult } from './covenant-sdk/types';

@Injectable({
  providedIn: 'root',
})
export class CovenantService {
  constructor(
    private readonly rpcService: RpcService,
    private readonly networkConfigService: NetworkConfigService,
  ) {}

  /**
   * Get the wRPC URL for the current network
   */
  private getRpcUrl(): string {
    const config = this.networkConfigService.getActiveNetwork();
    
    // If using resolver, return empty (the SDK will use resolver)
    if (config.useResolver) {
      return '';
    }
    
    return config.wrpcUrl;
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
