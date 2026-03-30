import { ethers } from 'ethers';
import { BaseContract } from '../base-contract';
import { WalletService } from '../../../../wallet.service';
import AaveUiDataProviderABI from '../../abis/aave-ui-data-provider.json';

export interface AggregatedReserveData {
  underlyingAsset: string;
  name: string;
  symbol: string;
  decimals: bigint;
  baseLTVasCollateral: bigint;
  reserveLiquidationThreshold: bigint;
  reserveLiquidationBonus: bigint;
  reserveFactor: bigint;
  usageAsCollateralEnabled: boolean;
  borrowingEnabled: boolean;
  isActive: boolean;
  isFrozen: boolean;
  liquidityRate: bigint;
  variableBorrowRate: bigint;
  aTokenAddress: string;
  variableDebtTokenAddress: string;
  availableLiquidity: bigint;
  totalScaledVariableDebt: bigint;
  priceInMarketReferenceCurrency: bigint;
  supplyCap: bigint;
  borrowCap: bigint;
  isPaused: boolean;
}

export interface UserReserveData {
  underlyingAsset: string;
  scaledATokenBalance: bigint;
  usageAsCollateralEnabled: boolean;
  scaledVariableDebt: bigint;
  currentATokenBalance?: bigint;
  currentVariableDebt?: bigint;
}

export interface BaseCurrencyInfo {
  marketReferenceCurrencyUnit: bigint;
  marketReferenceCurrencyPriceInUsd: bigint;
  networkBaseTokenPriceInUsd: bigint;
  networkBaseTokenPriceDecimals: number;
}

export class AaveUiDataProviderContract extends BaseContract {
  static getContract(address: string, walletService: WalletService): AaveUiDataProviderContract {
    return new AaveUiDataProviderContract(address, walletService);
  }

  constructor(address: string, walletService: WalletService) {
    super(address, AaveUiDataProviderABI, walletService);
  }

  async getReservesData(providerAddress: string): Promise<{
    reservesData: AggregatedReserveData[];
    baseCurrencyInfo: BaseCurrencyInfo;
  }> {
    const result = await this.callViewMethod<[AggregatedReserveData[], BaseCurrencyInfo]>(
      'getReservesData',
      providerAddress,
    );
    return { reservesData: result[0], baseCurrencyInfo: result[1] };
  }

  async getUserReservesData(
    providerAddress: string,
    user: string,
  ): Promise<{ userReservesData: UserReserveData[]; userEmodeCategoryId: number }> {
    const result = await this.callViewMethod<[UserReserveData[], number]>(
      'getUserReservesData',
      providerAddress,
      user,
    );
    return { userReservesData: result[0], userEmodeCategoryId: result[1] };
  }
}
