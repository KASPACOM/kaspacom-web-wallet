import { ethers } from 'ethers';
import { BaseContract } from '../base-contract';
import { WalletService } from '../../../../wallet.service';
import { WalletActionService } from '../../../../wallet-action.service';
import AavePoolABI from '../../abis/aave-pool-abi.json';

export interface UserAccountData {
  totalCollateralBase: bigint;
  totalDebtBase: bigint;
  availableBorrowsBase: bigint;
  currentLiquidationThreshold: bigint;
  ltv: bigint;
  healthFactor: bigint;
}

export class AavePoolContract extends BaseContract {
  static getContract(
    address: string,
    walletService: WalletService,
    walletActionService?: WalletActionService,
  ): AavePoolContract {
    return new AavePoolContract(address, walletService, walletActionService);
  }

  constructor(
    address: string,
    walletService: WalletService,
    walletActionService?: WalletActionService,
  ) {
    super(address, AavePoolABI, walletService, walletActionService);
  }

  async supply(
    asset: string,
    amount: ethers.BigNumberish,
    onBehalfOf: string,
    referralCode = 0,
  ) {
    return await this.doContractAction('supply', asset, amount, onBehalfOf, referralCode);
  }

  async withdraw(asset: string, amount: ethers.BigNumberish, to: string) {
    return await this.doContractAction('withdraw', asset, amount, to);
  }

  async borrow(
    asset: string,
    amount: ethers.BigNumberish,
    interestRateMode: number,
    referralCode = 0,
    onBehalfOf: string,
  ) {
    return await this.doContractAction('borrow', asset, amount, interestRateMode, referralCode, onBehalfOf);
  }

  async repay(
    asset: string,
    amount: ethers.BigNumberish,
    interestRateMode: number,
    onBehalfOf: string,
  ) {
    return await this.doContractAction('repay', asset, amount, interestRateMode, onBehalfOf);
  }

  async getUserAccountData(user: string): Promise<UserAccountData> {
    return await this.callViewMethod<UserAccountData>('getUserAccountData', user);
  }

  async getReservesList(): Promise<string[]> {
    return await this.callViewMethod<string[]>('getReservesList');
  }
}
