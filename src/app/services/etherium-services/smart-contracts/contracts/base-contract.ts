import { ethers } from 'ethers';
import { WalletActionService } from '../../../wallet-action.service';
import { EIP1193RequestType } from '@kaspacom/wallet-messages';
import { WalletService } from '../../../wallet.service';
import { WalletActionResultWithError } from '../../../../types/wallet-action-result';
export type ContractABI = ethers.InterfaceAbi;
export type ContractMethodArgs = unknown[];

export abstract class BaseContract {
  protected contract: ethers.Contract;

  constructor(
    protected walletService: WalletService,
    protected walletActionService: WalletActionService,
    protected address: string,
    protected abi: ContractABI,
  ) {

    const provider = this.walletService.getCurrentWallet()?.getL2Provider()?.getProvider();

    if (!provider) {
      throw new Error('No provider found');
    }


    this.contract = new ethers.Contract(address, abi, provider);
  }

  public getAddress(): string {
    return this.address;
  }

  protected async callViewMethod<T>(
    methodName: string,
    ...args: ContractMethodArgs
  ): Promise<T> {
    if (typeof this.contract[methodName] === 'function') {
      return await this.contract[methodName](...args);
    }
    throw new Error(`Method ${methodName} does not exist on contract`);
  }

  // This function is encoding function data and optionally checking if it's possible to do the action
  async encodeFunctionData(methodName: string, ...args: ContractMethodArgs) {
    if (typeof this.contract.interface.encodeFunctionData === 'function') {
      let contractFunctionData = undefined;
      try {
        contractFunctionData = this.contract.interface.encodeFunctionData(
          methodName,
          args,
        );
      } catch (err) {
        console.error(err);
        throw new Error(
          `Error encoding function data for ${methodName}: ${(err as Error).message
          }`,
        );
      }

      return contractFunctionData;
    }
    throw new Error(`Method ${methodName} does not exist on contract`);
  }

  protected async doContractAction(
    methodName: string,
    ...args: ContractMethodArgs
  ): Promise<WalletActionResultWithError> {
    return await this.doContractActionPayable(methodName, 0n, true, ...args);
  }

  // This function is checking if it's possible to do the payable action
  protected async doContractActionPayable(
    methodName: string,
    value: ethers.BigNumberish,
    ...args: ContractMethodArgs
  ): Promise<WalletActionResultWithError> {
    if (typeof this.contract.interface.encodeFunctionData === 'function') {
      let contractFunctionData = undefined;
      try {
        contractFunctionData = this.contract.interface.encodeFunctionData(
          methodName,
          args,
        );
      } catch (err) {
        throw new Error(
          `Error encoding function data for ${methodName}: ${(err as Error).message
          }`,
        );
      }

      const action = this.walletActionService.createEIP1193Action({
        method: EIP1193RequestType.SEND_TRANSACTION,
        params: [{
          from: (await this.walletService.getCurrentWallet()!.getL2WalletAddress())!,
          to: this.getAddress(),
          data: contractFunctionData,
          value: String(value || '0'),
        }],
      });

      return await this.walletActionService.validateAndDoActionAfterApproval(action);
    }
    throw new Error(`Method ${methodName} does not exist on contract`);
  }

  public async getEvents<T>(
    eventName: string,
    filter?: {
      fromBlock?: number;
      toBlock?: number;
      topics?: Array<string | Array<string>>;
    },
  ): Promise<T[]> {
    try {
      const events = await this.contract.queryFilter(
        this.contract.filters[eventName](),
        filter?.fromBlock,
        filter?.toBlock,
      );
      return events as unknown as T[];
    } catch (err) {
      throw new Error(
        `Error querying events for ${eventName}: ${(err as Error).message}`,
      );
    }
  }
}
