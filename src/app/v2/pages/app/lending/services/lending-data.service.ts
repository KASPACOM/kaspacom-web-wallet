import { computed, inject, Injectable, signal } from '@angular/core';
import { ethers, formatUnits } from 'ethers';
import { WalletService } from '../../../../../services/wallet.service';
import { WalletActionService } from '../../../../../services/wallet-action.service';
import { AavePoolContract, UserAccountData } from '../../../../../services/etherium-services/smart-contracts/contracts/aave/aave-pool.contract';
import {
  AaveUiDataProviderContract,
  AggregatedReserveData,
} from '../../../../../services/etherium-services/smart-contracts/contracts/aave/aave-ui-data-provider.contract';
import { AaveDataProviderContract, UserReserveData } from '../../../../../services/etherium-services/smart-contracts/contracts/aave/aave-data-provider.contract';
import { ERC20Contract } from '../../../../../services/etherium-services/smart-contracts/contracts/erc20-contract';

export interface LendingToken {
  symbol: string;
  address: string;
  decimals: number;
  supplyApy: number;
  borrowApy: number;
  usdPrice: number;
  // User data
  walletBalance: string;
  suppliedBalance: string;   // aToken balance
  borrowedBalance: string;   // variable debt balance
  isCollateral: boolean;
  canSupply: boolean;
  canWithdraw: boolean;
  canBorrow: boolean;
  canRepay: boolean;
  // Market
  isActive: boolean;
  isFrozen: boolean;
  borrowingEnabled: boolean;
  ltv: string;
  liquidationThreshold: string;
  aTokenAddress: string;
  variableDebtTokenAddress: string;
}

export interface UserMetrics {
  totalCollateralUsd: number;
  totalDebtUsd: number;
  availableBorrowsUsd: number;
  healthFactor: number;
  ltv: number;
  loading: boolean;
}

export const VARIABLE_RATE_MODE = 2;

// Contract addresses on IGRA testnet — update to mainnet when ready
// TODO: Replace placeholder addresses with actual IGRA Aave V3 deployments
export const IGRA_LENDING_CONTRACTS = {
  POOL_ADDRESSES_PROVIDER: '0xeE03b5c85d38d3F39A62ceEBe4D0A1B3D25e7E7',
  POOL: '0x16F5A35647D6F03D5D3da7b35409D65ba03aF3B2',
  UI_DATA_PROVIDER: '0x42A7B860C15B52F1b91fA16C3bd7FC7360B6cD4c',
  DATA_PROVIDER: '0x3e9708d80f7B3e43118013075F7e95CE3AB31F31',
};

const RAY = 10n ** 27n;
const SECONDS_PER_YEAR = 31536000n;

function rayToApy(ray: bigint): number {
  if (!ray || ray === 0n) return 0;
  const depositApy = ((1 + Number(ray) / Number(RAY) / Number(SECONDS_PER_YEAR)) ** Number(SECONDS_PER_YEAR) - 1) * 100;
  return Math.round(depositApy * 100) / 100;
}

@Injectable()
export class LendingDataService {
  private walletService = inject(WalletService);
  private walletActionService = inject(WalletActionService);

  private _tokens = signal<LendingToken[]>([]);
  private _userMetrics = signal<UserMetrics>({
    totalCollateralUsd: 0,
    totalDebtUsd: 0,
    availableBorrowsUsd: 0,
    healthFactor: 0,
    ltv: 0,
    loading: false,
  });
  private _isLoading = signal(false);
  private _error = signal<string | null>(null);

  readonly tokens = this._tokens.asReadonly();
  readonly userMetrics = this._userMetrics.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly suppliedTokens = computed(() =>
    this._tokens().filter((t) => parseFloat(t.suppliedBalance) > 0),
  );

  readonly borrowedTokens = computed(() =>
    this._tokens().filter((t) => parseFloat(t.borrowedBalance) > 0),
  );

  readonly availableToSupply = computed(() =>
    this._tokens().filter((t) => t.canSupply && parseFloat(t.walletBalance) > 0),
  );

  readonly availableToBorrow = computed(() =>
    this._tokens().filter((t) => t.canBorrow && t.borrowingEnabled && t.isActive && !t.isFrozen),
  );

  private getPool(): AavePoolContract {
    return AavePoolContract.getContract(
      IGRA_LENDING_CONTRACTS.POOL,
      this.walletService,
      this.walletActionService,
    );
  }

  private getUiDataProvider(): AaveUiDataProviderContract {
    return AaveUiDataProviderContract.getContract(
      IGRA_LENDING_CONTRACTS.UI_DATA_PROVIDER,
      this.walletService,
    );
  }

  private getDataProvider(): AaveDataProviderContract {
    return AaveDataProviderContract.getContract(
      IGRA_LENDING_CONTRACTS.DATA_PROVIDER,
      this.walletService,
    );
  }

  private getErc20(address: string): ERC20Contract {
    return ERC20Contract.getContract(address, this.walletService, this.walletActionService);
  }

  async loadData(): Promise<void> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const userAddress = this.walletService.getCurrentWallet()?.getL2WalletAddress();
      if (!userAddress) {
        this._error.set('No L2 wallet connected');
        return;
      }

      const uiProvider = this.getUiDataProvider();
      const dataProvider = this.getDataProvider();

      // Load reserves data
      const reservesResult = await uiProvider.getReservesData(IGRA_LENDING_CONTRACTS.POOL_ADDRESSES_PROVIDER);
      const { reservesData, baseCurrencyInfo } = reservesResult;

      // Build a map of user reserve data fetched per-asset from the DataProvider
      const userReservesMap = new Map<string, UserReserveData>();
      await Promise.all(
        reservesData.map(async (reserve) => {
          try {
            const ur = await dataProvider.getUserReserveData(reserve.underlyingAsset, userAddress);
            userReservesMap.set(reserve.underlyingAsset.toLowerCase(), ur);
          } catch {
            // ignore per-asset errors
          }
        }),
      );

      // Process tokens
      const tokens: LendingToken[] = [];
      for (const reserve of reservesData) {
        if (!reserve.isActive) continue;

        const userReserve = userReservesMap.get(reserve.underlyingAsset.toLowerCase());

        // Get wallet balance
        let walletBalance = '0';
        try {
          const erc20 = ERC20Contract.getContract(reserve.underlyingAsset, this.walletService);
          const rawBalance = await erc20.balanceOf(userAddress) as bigint;
          walletBalance = formatUnits(rawBalance, Number(reserve.decimals));
        } catch {
          // ignore balance read errors
        }

        const supplyApy = rayToApy(reserve.liquidityRate);
        const borrowApy = rayToApy(reserve.variableBorrowRate);

        // USD price from baseCurrency ref
        const priceInRef = Number(reserve.priceInMarketReferenceCurrency);
        const refUnit = Number(baseCurrencyInfo.marketReferenceCurrencyUnit);
        const refPriceUsd = Number(baseCurrencyInfo.networkBaseTokenPriceInUsd) /
          (10 ** baseCurrencyInfo.networkBaseTokenPriceDecimals);
        const usdPrice = refUnit > 0 ? (priceInRef / refUnit) * refPriceUsd : 0;

        const suppliedBalance = userReserve?.currentATokenBalance != null && userReserve.currentATokenBalance > 0n
          ? formatUnits(userReserve.currentATokenBalance, Number(reserve.decimals))
          : '0';

        const borrowedBalance = userReserve?.currentVariableDebt != null && userReserve.currentVariableDebt > 0n
          ? formatUnits(userReserve.currentVariableDebt, Number(reserve.decimals))
          : '0';

        tokens.push({
          symbol: reserve.symbol,
          address: reserve.underlyingAsset,
          decimals: Number(reserve.decimals),
          supplyApy,
          borrowApy,
          usdPrice,
          walletBalance,
          suppliedBalance,
          borrowedBalance,
          isCollateral: userReserve?.usageAsCollateralEnabled ?? reserve.usageAsCollateralEnabled ?? false,
          canSupply: parseFloat(walletBalance) > 0 && reserve.isActive && !reserve.isFrozen && !reserve.isPaused,
          canWithdraw: parseFloat(suppliedBalance) > 0 && !reserve.isPaused,
          canBorrow: reserve.borrowingEnabled && reserve.isActive && !reserve.isFrozen && !reserve.isPaused,
          canRepay: parseFloat(borrowedBalance) > 0 && !reserve.isPaused,
          isActive: reserve.isActive,
          isFrozen: reserve.isFrozen,
          borrowingEnabled: reserve.borrowingEnabled,
          ltv: formatUnits(reserve.baseLTVasCollateral, 2),
          liquidationThreshold: formatUnits(reserve.reserveLiquidationThreshold, 2),
          aTokenAddress: reserve.aTokenAddress,
          variableDebtTokenAddress: reserve.variableDebtTokenAddress,
        });
      }

      this._tokens.set(tokens);

      // Load user account data (health factor etc.)
      await this.loadUserMetrics(userAddress);
    } catch (e) {
      this._error.set((e as Error).message ?? 'Failed to load lending data');
      console.error('LendingDataService.loadData error:', e);
    } finally {
      this._isLoading.set(false);
    }
  }

  async loadUserMetrics(userAddress: string): Promise<void> {
    this._userMetrics.update((m) => ({ ...m, loading: true }));
    try {
      const pool = this.getPool();
      const data: UserAccountData = await pool.getUserAccountData(userAddress);

      const BASE_UNIT = 100000000n; // 1e8
      const totalCollateralUsd = Number(data.totalCollateralBase) / Number(BASE_UNIT);
      const totalDebtUsd = Number(data.totalDebtBase) / Number(BASE_UNIT);
      const availableBorrowsUsd = Number(data.availableBorrowsBase) / Number(BASE_UNIT);
      const healthFactor = data.healthFactor === ethers.MaxUint256
        ? Infinity
        : Number(data.healthFactor) / 1e18;
      const ltv = totalCollateralUsd > 0 ? (totalDebtUsd / totalCollateralUsd) * 100 : 0;

      this._userMetrics.set({
        totalCollateralUsd,
        totalDebtUsd,
        availableBorrowsUsd,
        healthFactor,
        ltv,
        loading: false,
      });
    } catch (e) {
      console.error('loadUserMetrics error:', e);
      this._userMetrics.update((m) => ({ ...m, loading: false }));
    }
  }

  // --- Actions ---

  async approveAndSupply(token: LendingToken, amount: string): Promise<boolean> {
    const userAddress = this.walletService.getCurrentWallet()?.getL2WalletAddress();
    if (!userAddress) return false;

    try {
      const parsedAmount = ethers.parseUnits(amount, token.decimals);
      const erc20 = this.getErc20(token.address);

      // Check allowance
      const allowance = await erc20.allowance(userAddress, IGRA_LENDING_CONTRACTS.POOL) as bigint;
      if (allowance < parsedAmount) {
        const approveResult = await erc20.approve(IGRA_LENDING_CONTRACTS.POOL, parsedAmount.toString());
        if (!approveResult?.result) return false;
      }

      const pool = this.getPool();
      const result = await pool.supply(token.address, parsedAmount, userAddress);
      return !!result?.result;
    } catch (e) {
      console.error('supply error:', e);
      return false;
    }
  }

  async withdraw(token: LendingToken, amount: string): Promise<boolean> {
    const userAddress = this.walletService.getCurrentWallet()?.getL2WalletAddress();
    if (!userAddress) return false;

    try {
      const parsedAmount = ethers.parseUnits(amount, token.decimals);
      const pool = this.getPool();
      const result = await pool.withdraw(token.address, parsedAmount, userAddress);
      return !!result?.result;
    } catch (e) {
      console.error('withdraw error:', e);
      return false;
    }
  }

  async borrow(token: LendingToken, amount: string): Promise<boolean> {
    const userAddress = this.walletService.getCurrentWallet()?.getL2WalletAddress();
    if (!userAddress) return false;

    try {
      const parsedAmount = ethers.parseUnits(amount, token.decimals);
      const pool = this.getPool();
      const result = await pool.borrow(token.address, parsedAmount, VARIABLE_RATE_MODE, 0, userAddress);
      return !!result?.result;
    } catch (e) {
      console.error('borrow error:', e);
      return false;
    }
  }

  async approveAndRepay(token: LendingToken, amount: string): Promise<boolean> {
    const userAddress = this.walletService.getCurrentWallet()?.getL2WalletAddress();
    if (!userAddress) return false;

    try {
      const parsedAmount = ethers.parseUnits(amount, token.decimals);
      const isFullRepay = amount === token.borrowedBalance;
      const repayAmount = isFullRepay ? ethers.MaxUint256 : parsedAmount;
      const erc20 = this.getErc20(token.address);

      const allowance = await erc20.allowance(userAddress, IGRA_LENDING_CONTRACTS.POOL) as bigint;
      if (allowance < repayAmount) {
        const approveResult = await erc20.approve(IGRA_LENDING_CONTRACTS.POOL, repayAmount.toString());
        if (!approveResult?.result) return false;
      }

      const pool = this.getPool();
      const result = await pool.repay(token.address, repayAmount, VARIABLE_RATE_MODE, userAddress);
      return !!result?.result;
    } catch (e) {
      console.error('repay error:', e);
      return false;
    }
  }

  formatUsd(amount: number): string {
    if (amount === 0) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  formatHealthFactor(hf: number): string {
    if (!isFinite(hf)) return '∞';
    return hf.toFixed(2);
  }
}
