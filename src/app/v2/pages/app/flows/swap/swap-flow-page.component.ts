import {
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { FormsModule } from '@angular/forms';
import type {
  Erc20Token,
  SwapSdkController,
  SwapSettings,
  SwapControllerOutput,
} from '@kaspacom/swap-sdk';
import {
  createKaspaComSwapController,
  DEFAULT_SWAP_SETTINGS,
  LoaderStatuses,
  NETWORKS,
} from '@kaspacom/swap-sdk';
import {
  KcButtonComponent,
  KcIconComponent,
  KcIconButtonComponent,
  SwitchOption,
  NotificationService,
} from '@kaspacom/ui-kit';
import {
  EIP1193RequestPayload,
  EIP1193RequestType,
} from '@kaspacom/wallet-messages';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ethers } from 'ethers';
import { TokenLogoComponent } from '../../../../../components/token-logo/token-logo.component';
import { CommaFormatterPipe } from '../../../../../pipes/comma-formatter.pipe';
import { AssetsManagerService } from '../../../../../services/assets-manager/assets-manager.service';
import {
  L2AssetsStoreService,
  L2_ASSET_KEYS,
} from '../../../../../services/assets-manager/assets-stores/l2-assets-store.service';
import { EthereumWalletActionsService } from '../../../../../services/etherium-services/etherium-wallet-actions.service';
import { EthereumWalletChainManager } from '../../../../../services/etherium-services/etherium-wallet-chain.manager';
import { WalletService } from '../../../../../services/wallet.service';
import { SwapContextService } from '../../../../services/swap-context.service';
import {
  SwapSettingsModalComponent,
  SwapSettingsDialogData,
} from './components/swap-settings-modal/swap-settings-modal.component';
import {
  TokenSelectorModalComponent,
  TokenSelectorDialogData,
} from './components/token-selector-modal/token-selector-modal.component';
import {
  KAS_NATIVE_FEE_RESERVE,
  WALLET_APP_ID,
} from '../../../../../config/consts';

@Component({
  selector: 'app-swap-flow-page',
  standalone: true,
  imports: [
    FormsModule,
    KcButtonComponent,
    KcIconComponent,
    KcIconButtonComponent,
    CommaFormatterPipe,
    TokenLogoComponent,
  ],
  templateUrl: './swap-flow-page.component.html',
  styleUrl: './swap-flow-page.component.scss',
  host: {
    '[class.full-width]': 'true',
    '[class.full-height]': 'true',
  },
})
export class SwapFlowPageComponent implements OnInit, OnDestroy {
  private walletService = inject(WalletService);
  private chainManager = inject(EthereumWalletChainManager);
  private notificationService = inject(NotificationService);
  private ethereumWalletActionsService = inject(EthereumWalletActionsService);
  private swapContextService = inject(SwapContextService);
  private assetsManagerService = inject(AssetsManagerService);
  private dialog = inject(Dialog);

  private readonly nativeTokenAddress =
    '0x0000000000000000000000000000000000000000';

  // State
  controller = signal<SwapSdkController | null>(null);
  controllerState = signal<SwapControllerOutput | null>(null);

  // Inputs
  fromToken = signal<Erc20Token | null>(null);
  toToken = signal<Erc20Token | null>(null);
  fromAmountInput = signal<string>('');
  toAmountInput = signal<string>('');

  // Settings
  currentSettings = signal<SwapSettings>(DEFAULT_SWAP_SETTINGS);

  // Modals
  tokenModalOpen = signal<'from' | 'to' | null>(null);

  // Internal State
  currentIsOutput = signal(false);
  private isExecutingSwap = false;
  private balanceUpdateUnsubscribe: (() => void) | null = null;

  // Wrapped token for current network
  currentNetworkWrappedToken = signal<Erc20Token | null>(null);

  // Data
  allTokens = signal<Erc20Token[]>([]);
  loadingTokens = signal(false);

  routePath = computed(() => {
    const route = this.controllerState()?.tradeInfo?.route;
    if (!route) return '';
    return route.path.map((t: any) => t.symbol).join(' → ');
  });

  // Debounce
  private amountSubject = new Subject<{ amount: string; isOutput: boolean }>();
  private amountSub: Subscription;

  // Wrap/unwrap detection
  isFromTokenNative = computed(
    () => this.fromToken()?.address.toLowerCase() === this.nativeTokenAddress,
  );

  isWrapOperation = computed(() => {
    const from = this.fromToken();
    const to = this.toToken();
    const wrapped = this.currentNetworkWrappedToken();
    if (!from || !to || !wrapped) return false;
    return (
      from.address.toLowerCase() === this.nativeTokenAddress &&
      to.address.toLowerCase() === wrapped.address.toLowerCase()
    );
  });

  isUnwrapOperation = computed(() => {
    const from = this.fromToken();
    const to = this.toToken();
    const wrapped = this.currentNetworkWrappedToken();
    if (!from || !to || !wrapped) return false;
    return (
      from.address.toLowerCase() === wrapped.address.toLowerCase() &&
      to.address.toLowerCase() === this.nativeTokenAddress
    );
  });

  isWrapUnwrapOperation = computed(
    () => this.isWrapOperation() || this.isUnwrapOperation(),
  );

  // Effective max balance for fromToken (subtracts fee reserve for native KAS)
  fromTokenEffectiveMaxBalance = computed(() => {
    const balance = this.fromToken()?.balance ?? 0;
    return this.isFromTokenNative()
      ? Math.max(0, balance - KAS_NATIVE_FEE_RESERVE)
      : balance;
  });

  // Computed
  minReceived = computed(() => {
    const state = this.controllerState();
    const amountOut = state?.computed?.amountOut;
    if (!amountOut) return null;

    const slippage =
      parseFloat(this.currentSettings().maxSlippage || '0.5') / 100;
    const val = parseFloat(amountOut.toString());
    if (isNaN(val)) return null;

    const minOut = val * (1 - slippage);
    return minOut.toFixed(6).replace(/\.?0+$/, '');
  });

  percentageOptions: SwitchOption[] = [
    { label: '25%', value: 25 },
    { label: '50%', value: 50 },
    { label: '75%', value: 75 },
    { label: 'MAX', value: 100 },
  ];

  selectedPercentage = computed(() => {
    const effectiveMax = this.fromTokenEffectiveMaxBalance();
    if (!effectiveMax) return null;

    const amount = parseFloat(this.fromAmountInput());
    if (isNaN(amount) || effectiveMax === 0) return null;

    const percentage = (amount / effectiveMax) * 100;

    const tolerance = 0.01;
    if (Math.abs(percentage - 25) < tolerance) return 25;
    if (Math.abs(percentage - 50) < tolerance) return 50;
    if (Math.abs(percentage - 75) < tolerance) return 75;
    if (Math.abs(percentage - 100) < tolerance) return 100;

    return null;
  });

  // Error states
  isFromAmountInvalid = computed(() => {
    const input = this.fromAmountInput();
    if (!input) return false;

    const validNumberRegex = /^[0-9]*\.?[0-9]*$/;
    if (!validNumberRegex.test(input)) return true;

    const val = parseFloat(input);
    return isNaN(val) || val < 0 || !Number.isFinite(val);
  });

  isInsufficientBalance = computed(() => {
    const input = this.fromAmountInput();
    if (!input) return false;

    const effectiveMax = this.fromTokenEffectiveMaxBalance();
    const amount = parseFloat(input);

    if (isNaN(effectiveMax) || isNaN(amount)) return false;
    return amount > effectiveMax;
  });

  fromInputError = computed(() => {
    if (this.isFromAmountInvalid()) return 'invalid';
    if (this.isInsufficientBalance()) return 'insufficient';
    return null;
  });

  isSwapDisabled = computed(() => {
    if (this.isWrapUnwrapOperation()) {
      const amount = parseFloat(this.fromAmountInput());
      return (
        !this.fromAmountInput() ||
        isNaN(amount) ||
        amount <= 0 ||
        this.isFromAmountInvalid() ||
        this.isInsufficientBalance()
      );
    }

    const state = this.controllerState();
    return (
      !state ||
      !!state.loader ||
      !state.computed?.amountOut ||
      !!state.error ||
      !this.fromAmountInput() ||
      parseFloat(this.fromAmountInput()) <= 0 ||
      this.isFromAmountInvalid() ||
      this.isInsufficientBalance()
    );
  });

  swapText = computed(() => {
    if (this.isWrapOperation()) {
      if (this.isInsufficientBalance()) {
        const symbol = this.fromToken()?.symbol || 'token';
        return `Insufficient ${symbol}`;
      }
      return 'Wrap';
    }
    if (this.isUnwrapOperation()) {
      if (this.isInsufficientBalance()) {
        const symbol = this.fromToken()?.symbol || 'token';
        return `Insufficient ${symbol}`;
      }
      return 'Unwrap';
    }

    const state = this.controllerState();
    const loader = state?.loader;

    if (loader === LoaderStatuses.CALCULATING_QUOTE) return 'Calculating...';
    if (loader === LoaderStatuses.SWAPPING) return 'Swapping...';
    if (loader === LoaderStatuses.APPROVING) return 'Approving...';
    if (this.loadingTokens()) return 'Loading Tokens...';

    if (this.isFromAmountInvalid()) return 'Invalid Input';
    if (this.isInsufficientBalance()) {
      const symbol = this.fromToken()?.symbol || 'token';
      return `Insufficient ${symbol}`;
    }

    return 'Swap';
  });

  constructor() {
    this.amountSub = this.amountSubject
      .pipe(
        debounceTime(500),
        distinctUntilChanged(
          (p, c) => p.amount === c.amount && p.isOutput === c.isOutput,
        ),
      )
      .subscribe(({ amount, isOutput }) => {
        this.updateControllerAmount(amount, isOutput);
      });

    effect(
      () => {
        const state = this.controllerState();
        if (!state) return;

        if (state.loader) return;

        const computed = state.computed;
        if (!computed) return;

        if (this.currentIsOutput()) {
          if (computed.maxAmountIn)
            this.fromAmountInput.set(computed.maxAmountIn.toString());
        } else {
          if (computed.amountOut)
            this.toAmountInput.set(computed.amountOut.toString());
        }
      },
      { allowSignalWrites: true },
    );
  }

  async ngOnInit() {
    await this.initializeController();
  }

  ngOnDestroy() {
    this.amountSub.unsubscribe();
    this.balanceUpdateUnsubscribe?.();
    this.controller()?.disconnectWallet();
    this.controller()?.destroy();
  }

  async initializeController() {
    try {
      const currentChainId = this.chainManager.getCurrentChainSignal()();
      if (!currentChainId) throw new Error('No chain selected');

      const config = this.chainManager.getChainEnvConfig(currentChainId);
      if (!config) {
        console.error('No config for chain', currentChainId);
        return;
      }

      // Prepare network configuration with optional wrapped token override
      type SwapNetworkMap = typeof NETWORKS;
      type SwapNetworkName = keyof SwapNetworkMap;
      type SwapNetworkConfig = SwapNetworkMap[SwapNetworkName];

      const sdkName = config.sdkName as SwapNetworkName;
      const baseNetwork: SwapNetworkConfig | undefined = NETWORKS[sdkName];
      let networkConfig: SwapNetworkName | SwapNetworkConfig = sdkName;

      if (
        baseNetwork &&
        config.customChainConfig.wrappedTokenAddress &&
        baseNetwork.wrappedToken
      ) {
        networkConfig = {
          ...baseNetwork,
          wrappedToken: {
            ...baseNetwork.wrappedToken,
            address: config.customChainConfig.wrappedTokenAddress,
          },
        };
      }

      // Set wrapped token for this network in component state
      const wrappedToken =
        typeof networkConfig === 'string'
          ? baseNetwork?.wrappedToken
          : networkConfig.wrappedToken;

      if (wrappedToken) {
        this.currentNetworkWrappedToken.set(wrappedToken);
      }

      // Connect Wallet
      const currentWallet = this.walletService.getCurrentWallet();
      if (!currentWallet) {
        console.error('No wallet connected');
        return;
      }

      const ctrl = createKaspaComSwapController({
        networkConfig: networkConfig,
        onChange: async (state) => {
          this.controllerState.set(state);

          if (state.error) {
            console.error('Swap State Error:', state.error);
            // Suppress errors during wrap/unwrap or swap execution
            if (!this.isExecutingSwap && !this.isWrapUnwrapOperation()) {
              this.notificationService.error('Error', state.error);
            }
          }
        },
        refreshPairsInterval: 20000,
        updateQuoteAfterRefreshPairs: true,
      });

      await ctrl.connectWallet({
        request: async (request: {
          method: string;
          params?: Array<any> | Record<string, any>;
        }) => {
          const result = await this.ethereumWalletActionsService.handleRequest(
            request as EIP1193RequestPayload<any>,
            undefined,
            true,
            WALLET_APP_ID,
          );

          if (result.error) {
            if (result.error.code === 4001) {
              const err: any = new Error('User rejected');
              err.code = 4001;
              throw err;
            }
            console.error(result.error);
            this.notificationService.error('Swap Error', result.error.message);
            const err: any = new Error(result.error.message ?? 'Unknown error');
            err.code = result.error.code;
            throw err;
          }

          return result.result;
        },
      });

      this.controller.set(ctrl);

      // Load tokens
      this.loadingTokens.set(true);
      try {
        const tokens = await ctrl.getTokensFromGraph(1000);
        const nativeToken = NETWORKS[config.sdkName]?.nativeToken;
        if (nativeToken) {
          tokens.unshift(nativeToken);
        }

        // Get tokens with balances from assets manager
        const erc20WithBalances: Erc20Token[] = this.assetsManagerService
          .getAllAssetStores()
          .l2.getAssets(L2_ASSET_KEYS.erc20);

        const balanceMap = new Map<string, number>();
        for (const token of erc20WithBalances) {
          balanceMap.set(token.address.toLowerCase(), token.balance || 0);
        }

        // Native token (KAS) balance from wallet L2 state
        const nativeBalance =
          currentWallet.getL2WalletStateSignal()()?.balanceFormatted || 0;
        balanceMap.set(this.nativeTokenAddress.toLowerCase(), nativeBalance);

        const tokensWithBalances = tokens.map((token) => ({
          ...token,
          balance: balanceMap.get(token.address.toLowerCase()) ?? 0,
        }));

        this.allTokens.set(tokensWithBalances);

        if (tokensWithBalances.length > 0)
          this.fromToken.set(tokensWithBalances[0]);
      } finally {
        this.loadingTokens.set(false);
      }
    } catch (err) {
      console.error('Failed to init swap', err);
      this.notificationService.error('Swap Error', 'Failed to initialize swap');
    }
  }

  onFromAmountChange(value: string) {
    this.currentIsOutput.set(false);
    this.fromAmountInput.set(value);

    if (this.isWrapUnwrapOperation()) {
      // 1:1 ratio for wrap/unwrap
      this.toAmountInput.set(value);
      return;
    }

    this.amountSubject.next({ amount: value, isOutput: false });
  }

  onToAmountChange(value: string) {
    this.currentIsOutput.set(true);
    this.toAmountInput.set(value);

    if (this.isWrapUnwrapOperation()) {
      // 1:1 ratio for wrap/unwrap
      this.fromAmountInput.set(value);
      return;
    }

    this.amountSubject.next({ amount: value, isOutput: true });
  }

  updateControllerAmount(amount: string, isOutput: boolean) {
    if (this.isWrapUnwrapOperation()) return;

    const from = this.fromToken();
    const to = this.toToken();
    if (!from || !to) return;

    const val = parseFloat(amount);
    const numVal = Number.isFinite(val) ? val : 0;

    this.controller()?.setData({
      fromToken: from,
      toToken: to,
      amount: numVal,
      isOutputAmount: isOutput,
    });
  }

  openTokenModal(type: 'from' | 'to') {
    this.tokenModalOpen.set(type);
    const excludedToken = computed(() =>
      type === 'from' ? this.toToken() : this.fromToken(),
    );
    this.dialog
      .open<Erc20Token | undefined, TokenSelectorDialogData>(
        TokenSelectorModalComponent,
        {
          width: '520px',
          data: {
            title: 'Select a token',
            showCloseButton: true,
            tokens: this.allTokens,
            isLoading: this.loadingTokens,
            excludedToken,
          },
        },
      )
      .closed.subscribe((token) => {
        this.tokenModalOpen.set(null);
        if (token) {
          this.onTokenSelect(token, type);
        }
      });
  }

  onTokenSelect(token: Erc20Token, type: 'from' | 'to') {
    if (type === 'from') {
      if (this.toToken()?.address === token.address) {
        this.toToken.set(this.fromToken());
      }
      this.fromToken.set(token);
    } else {
      if (this.fromToken()?.address === token.address) {
        this.fromToken.set(this.toToken());
      }
      this.toToken.set(token);
    }

    // Update with current input
    this.updateControllerAmount(this.fromAmountInput(), false);
  }

  switchTokens() {
    const from = this.fromToken();
    const to = this.toToken();

    this.fromToken.set(to);
    this.toToken.set(from);

    const fromAmount = this.fromAmountInput();
    const toAmount = this.toAmountInput();
    this.fromAmountInput.set(toAmount);
    this.toAmountInput.set(fromAmount);

    this.currentIsOutput.set(false);
    this.updateControllerAmount(toAmount, false);
  }

  onMaxClick() {
    this.onPercentageClick(100);
  }

  onPercentageClick(percentage: number) {
    const effectiveMax = this.fromTokenEffectiveMaxBalance();
    if (!effectiveMax) return;

    if (isNaN(effectiveMax)) return;

    const amount = ((effectiveMax * percentage) / 100).toString();
    this.onFromAmountChange(amount);
  }

  openSettingsModal() {
    this.dialog
      .open<SwapSettings | undefined, SwapSettingsDialogData>(
        SwapSettingsModalComponent,
        {
          data: {
            title: 'Settings',
            showCloseButton: true,
            initialSettings: this.currentSettings(),
          },
        },
      )
      .closed.subscribe((settings) => {
        if (settings) {
          this.onSettingsSave(settings);
        }
      });
  }

  onSettingsSave(settings: SwapSettings) {
    this.currentSettings.set(settings);
    this.controller()?.setData({
      settings: {
        ...DEFAULT_SWAP_SETTINGS,
        ...settings,
      },
    });
  }

  async executeSwap() {
    if (this.isWrapUnwrapOperation()) {
      await this.executeWrapOrUnwrap();
      return;
    }

    const ctrl = this.controller();
    if (!ctrl) return;

    const fromToken = this.fromToken();
    const toToken = this.toToken();
    if (!fromToken || !toToken) return;

    const currentChainId = this.chainManager.getCurrentChainSignal()();
    const chainConfig = currentChainId
      ? this.chainManager.getChainConfig(currentChainId)
      : null;

    const state = this.controllerState();
    const priceImpactValue = state?.tradeInfo?.priceImpact as any;
    let priceImpact = '0';
    if (priceImpactValue !== null && priceImpactValue !== undefined) {
      if (typeof priceImpactValue === 'number') {
        priceImpact = priceImpactValue.toFixed(2);
      } else if (typeof priceImpactValue === 'string') {
        priceImpact = priceImpactValue;
      } else if (typeof priceImpactValue.toSignificant === 'function') {
        try {
          priceImpact = priceImpactValue.toSignificant(2);
        } catch {
          priceImpact = '0';
        }
      } else if (typeof priceImpactValue.toFixed === 'function') {
        try {
          priceImpact = priceImpactValue.toFixed(2);
        } catch {
          priceImpact = '0';
        }
      } else if (
        priceImpactValue.numerator !== undefined &&
        priceImpactValue.denominator !== undefined
      ) {
        const num = Number(priceImpactValue.numerator);
        const denom = Number(priceImpactValue.denominator);
        if (denom !== 0 && !isNaN(num) && !isNaN(denom)) {
          priceImpact = ((num / denom) * 100).toFixed(2);
        }
      }
    }
    const estimatedGas =
      (state?.tradeInfo as any)?.gasEstimate?.toString() || '0';

    const swapContextId = this.swapContextService.setSwapContext({
      fromToken,
      toToken,
      fromAmount: this.fromAmountInput(),
      toAmount: this.toAmountInput(),
      minReceived: this.minReceived() || '',
      route: this.routePath(),
      settings: this.currentSettings(),
      networkName: chainConfig?.chainName || 'Unknown Network',
      priceImpact,
      estimatedGas,
    });

    this.isExecutingSwap = true;
    try {
      const tx = await ctrl.swap();
      if (tx) {
        this.notificationService.success(
          'Swap Submitted',
          'Transaction sent successfully',
        );
        this.fromAmountInput.set('');
        this.toAmountInput.set('');
        this.updateControllerAmount('0', false);
        this.waitForConfirmationAndRefresh(tx, fromToken, toToken);
      }
    } catch (err: any) {
      if (err?.code === 4001 || err?.info?.error?.code === 4001) {
        return;
      }
      this.notificationService.error(
        'Swap Failed',
        err?.message || 'Unknown error',
      );
    } finally {
      this.isExecutingSwap = false;
      this.swapContextService.clearSwapContext(swapContextId);
    }
  }

  private async executeWrapOrUnwrap(): Promise<void> {
    const fromToken = this.fromToken();
    const toToken = this.toToken();
    const wrappedToken = this.currentNetworkWrappedToken();
    if (!fromToken || !toToken || !wrappedToken) return;

    const walletAddress = this.walletService
      .getCurrentWallet()
      ?.getL2WalletAddress();
    if (!walletAddress) return;

    const amount = parseFloat(this.fromAmountInput());
    if (isNaN(amount) || amount <= 0) return;

    const operationName = this.isWrapOperation() ? 'Wrap' : 'Unwrap';

    this.isExecutingSwap = true;
    try {
      const iface = new ethers.Interface([
        'function deposit() payable',
        'function withdraw(uint256 amount)',
      ]);

      let encodedData: string;
      let value: string;

      if (this.isWrapOperation()) {
        const amountWei = ethers.parseUnits(amount.toString(), 18);
        encodedData = iface.encodeFunctionData('deposit', []);
        value = ethers.toBeHex(amountWei);
      } else {
        const decimals = wrappedToken.decimals || 18;
        const amountWei = ethers.parseUnits(amount.toString(), decimals);
        encodedData = iface.encodeFunctionData('withdraw', [amountWei]);
        value = '0x0';
      }

      const result = await this.ethereumWalletActionsService.handleRequest(
        {
          method: EIP1193RequestType.SEND_TRANSACTION,
          params: [
            {
              from: walletAddress,
              to: wrappedToken.address,
              data: encodedData,
              value,
            },
          ],
        } as EIP1193RequestPayload<any>,
        undefined,
        true,
        WALLET_APP_ID,
      );

      if (result.error) {
        if (result.error.code === 4001) {
          this.notificationService.error(
            `${operationName} Error`,
            'User rejected',
          );
          return;
        }
        this.notificationService.error(
          `${operationName} Error`,
          result.error.message,
        );
        return;
      }

      const txHash = result.result as string;
      this.notificationService.success(
        `${operationName} Submitted`,
        'Transaction sent successfully',
      );
      this.fromAmountInput.set('');
      this.toAmountInput.set('');
      this.waitForConfirmationAndRefresh(txHash, fromToken, toToken);
    } catch (err: any) {
      if (err?.code === 4001 || err?.info?.error?.code === 4001) {
        this.notificationService.error(
          `${operationName} Error`,
          'User rejected',
        );
        return;
      }
      this.notificationService.error(
        `${operationName} Failed`,
        err?.message || 'Unknown error',
      );
    } finally {
      this.isExecutingSwap = false;
    }
  }

  private async waitForConfirmationAndRefresh(
    txHash: string,
    fromToken?: Erc20Token,
    toToken?: Erc20Token,
  ): Promise<void> {
    try {
      const provider = this.chainManager.getCurrentWalletProvider();
      if (!provider) return;

      await provider.getTransactionReceipt(txHash);

      // Refresh native L2 balance (KAS)
      await this.walletService.getCurrentWallet()?.refreshL2Balance();

      // Directly fetch fresh balances from blockchain for non-native tokens.
      // This bypasses the graph API which may lag or miss new tokens entirely.
      const nativeAddr = this.nativeTokenAddress.toLowerCase();
      const l2Store = this.assetsManagerService.getAllAssetStores()
        .l2 as L2AssetsStoreService;
      const chainFetches: Promise<any>[] = [];

      if (fromToken && fromToken.address.toLowerCase() !== nativeAddr) {
        chainFetches.push(
          l2Store
            .getErc20InfoFromBlockchain(fromToken.address, true)
            .catch((e) =>
              console.error('Error fetching fromToken balance:', e),
            ),
        );
      }
      if (toToken && toToken.address.toLowerCase() !== nativeAddr) {
        chainFetches.push(
          l2Store
            .getErc20InfoFromBlockchain(toToken.address, true)
            .catch((e) => console.error('Error fetching toToken balance:', e)),
        );
      }

      await Promise.all(chainFetches);

      // Update local signals from the (now updated) store
      this.refreshLocalTokenBalances();
    } catch (err) {
      console.error('Error refreshing balances after swap:', err);
    }
  }

  private refreshLocalTokenBalances(): void {
    const erc20WithBalances: Erc20Token[] = this.assetsManagerService
      .getAllAssetStores()
      .l2.getAssets(L2_ASSET_KEYS.erc20);

    const balanceMap = new Map<string, number>();
    for (const token of erc20WithBalances) {
      balanceMap.set(token.address.toLowerCase(), token.balance || 0);
    }

    const nativeBalance =
      this.walletService.getCurrentWallet()?.getL2WalletStateSignal()()
        ?.balanceFormatted || 0;
    balanceMap.set(this.nativeTokenAddress.toLowerCase(), nativeBalance);

    this.allTokens.set(
      this.allTokens().map((token) => ({
        ...token,
        balance:
          balanceMap.get(token.address.toLowerCase()) ?? token.balance ?? 0,
      })),
    );

    const from = this.fromToken();
    if (from) {
      const newBalance = balanceMap.get(from.address.toLowerCase());
      if (newBalance !== undefined) {
        this.fromToken.set({ ...from, balance: newBalance });
      }
    }

    const to = this.toToken();
    if (to) {
      const newBalance = balanceMap.get(to.address.toLowerCase());
      if (newBalance !== undefined) {
        this.toToken.set({ ...to, balance: newBalance });
      }
    }
  }
}
