import { ethers } from 'ethers';
import { BaseContract } from '../base-contract';
import { WalletService } from '../../../../wallet.service';
import AaveDataProviderABI from '../../abis/aave-data-provider.json';

export interface UserReserveData {
  currentATokenBalance: bigint;
  currentStableDebt: bigint;
  currentVariableDebt: bigint;
  principalStableDebt: bigint;
  scaledVariableDebt: bigint;
  stableBorrowRate: bigint;
  liquidityRate: bigint;
  stableRateLastUpdated: number;
  usageAsCollateralEnabled: boolean;
}

export class AaveDataProviderContract extends BaseContract {
  static getContract(address: string, walletService: WalletService): AaveDataProviderContract {
    return new AaveDataProviderContract(address, walletService);
  }

  constructor(address: string, walletService: WalletService) {
    super(address, AaveDataProviderABI, walletService);
  }

  async getUserReserveData(asset: string, user: string): Promise<UserReserveData> {
    return await this.callViewMethod<UserReserveData>('getUserReserveData', asset, user);
  }

  async getReservesList(): Promise<string[]> {
    return await this.callViewMethod<string[]>('getAllReservesTokens');
  }
}
