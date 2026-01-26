import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  KcButtonComponent,
  KcInputComponent,
  KcIconComponent,
  NotificationService,
} from '@kaspacom/ui';
import {
  createKaspaComSwapController,
  DEFAULT_SWAP_SETTINGS,
  LoaderStatuses,
  NETWORKS,
} from '@kaspacom/swap-sdk';
import type {
  SwapSdkController,
  Erc20Token,
  SwapControllerOutput,
  SwapSettings,
} from '@kaspacom/swap-sdk';
import { WalletService } from '../../../../../services/wallet.service';
import { EthereumWalletChainManager } from '../../../../../services/etherium-services/etherium-wallet-chain.manager';
import { TokenSelectorModalComponent } from './components/token-selector-modal/token-selector-modal.component';
import { SwapSettingsModalComponent } from './components/swap-settings-modal/swap-settings-modal.component';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { CommaFormatterPipe } from '../../../../../pipes/comma-formatter.pipe';
import { EthereumWalletActionsService } from '../../../../../services/etherium-services/etherium-wallet-actions.service';
import { EIP1193RequestPayload } from '@kaspacom/wallet-messages';
import { TokenLogoComponent } from '../../../../../components/token-logo/token-logo.component';

@Component({
  selector: 'app-swap-flow-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    KcButtonComponent,
    KcInputComponent,
    KcIconComponent,
    TokenSelectorModalComponent,
    SwapSettingsModalComponent,
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

  // State
  controller = signal<SwapSdkController | null>(null);
  controllerState = signal<any>(null); // Using any to avoid type issues with library

  // Inputs
  fromToken = signal<Erc20Token | null>(null);
  toToken = signal<Erc20Token | null>(null);
  fromAmountInput = signal<string>('');
  toAmountInput = signal<string>('');

  // Settings
  currentSettings = signal<SwapSettings>(DEFAULT_SWAP_SETTINGS);

  // Modals
  tokenModalOpen = signal<'from' | 'to' | null>(null);
  settingsOpen = signal(false);

  // Internal State
  currentIsOutput = signal(false);

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

  // Computed
  minReceived = computed(() => {
    const state = this.controllerState();
    // Try to find minAmountOut or calculate it
    // Previous code used amountOut, let's use that if min isn't available
    const amountOut = state?.computed?.amountOut;
    if (!amountOut) return null;

    const slippage =
      parseFloat(this.currentSettings().maxSlippage || '0.5') / 100;
    // amountOut might be CurrencyAmount or string or number
    const val = parseFloat(amountOut.toString());
    if (isNaN(val)) return null;

    const minOut = val * (1 - slippage);
    return minOut.toFixed(6).replace(/\.?0+$/, '');
  });

  selectedPercentage = computed(() => {
    const token = this.fromToken();
    if (!token?.rawBalance) return null;

    const balance = parseFloat(token.rawBalance);
    const amount = parseFloat(this.fromAmountInput());

    if (isNaN(balance) || isNaN(amount) || balance === 0) return null;

    const percentage = (amount / balance) * 100;

    // Check if it matches any of our preset percentages (with small tolerance)
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

    // Check for invalid patterns (multiple dashes, invalid characters, etc.)
    const validNumberRegex = /^[0-9]*\.?[0-9]*$/;
    if (!validNumberRegex.test(input)) return true;

    const val = parseFloat(input);
    return isNaN(val) || val < 0 || !Number.isFinite(val);
  });

  isInsufficientBalance = computed(() => {
    const token = this.fromToken();
    const input = this.fromAmountInput();
    if (!token?.balance || !input) return false;

    const balance = token?.balance || 0;
    const amount = parseFloat(input);

    if (isNaN(balance) || isNaN(amount)) return false;
    return amount > balance;
  });

  fromInputError = computed(() => {
    if (this.isFromAmountInvalid()) return 'invalid';
    if (this.isInsufficientBalance()) return 'insufficient';
    return null;
  });

  isSwapDisabled = computed(() => {
    const state = this.controllerState();
    return (
      !state ||
      (state.loader && state.loader !== '') ||
      !state.computed?.amountOut ||
      !!state.errors?.insufficientBalance ||
      !this.fromAmountInput() ||
      parseFloat(this.fromAmountInput()) <= 0 ||
      this.isFromAmountInvalid() ||
      this.isInsufficientBalance()
    );
  });

  swapText = computed(() => {
    const state = this.controllerState();
    const loader = state?.loader;

    if (loader === LoaderStatuses.CALCULATING_QUOTE) return 'Calculating...';
    if (loader === LoaderStatuses.SWAPPING) return 'Swapping...';
    if (loader === LoaderStatuses.APPROVING) return 'Approving...';
    if (this.loadingTokens()) return 'Loading Tokens...';

    // Error states
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

        // If state is loading, don't update
        const loader = state.loader;
        if (loader && loader !== '') return;

        const computed = state.computed;
        if (!computed) return;

        if (this.currentIsOutput()) {
          // User entering Output (TO). Update Input (FROM)
          if (computed.maxAmountIn)
            this.fromAmountInput.set(computed.maxAmountIn.toString());
        } else {
          // User entering Input (FROM). Update Output (TO)
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

      // Connect Wallet
      const currentWallet = this.walletService.getCurrentWallet();
      if (!currentWallet) {
        console.error('No wallet connected');
        return;
      }

      const ctrl = createKaspaComSwapController({
        networkConfig: config.sdkName,
        onChange: async (state) => {
          this.controllerState.set(state);

          if (state.error) {
            console.error('Swap State Error:', state.error);
            this.notificationService.error('Error', state.error);
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
          );

          if (result.error) {
            console.error(result.error);
            this.notificationService.error('Swap Error', result.error.message);
            throw result;
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
        } else {
          console.warn('No native token found for sdkName:', config.sdkName);
        }
        this.allTokens.set(tokens);

        if (tokens.length > 0) this.fromToken.set(tokens[0]);
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
    this.amountSubject.next({ amount: value, isOutput: false });
  }

  onToAmountChange(value: string) {
    this.currentIsOutput.set(true);
    this.toAmountInput.set(value);
    this.amountSubject.next({ amount: value, isOutput: true });
  }

  updateControllerAmount(amount: string, isOutput: boolean) {
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
  }

  onTokenSelect(token: Erc20Token) {
    const type = this.tokenModalOpen();
    if (type === 'from') {
      if (this.toToken()?.address === token.address) {
        this.toToken.set(this.fromToken());
      }
      this.fromToken.set(token);
    } else if (type === 'to') {
      if (this.fromToken()?.address === token.address) {
        this.fromToken.set(this.toToken());
      }
      this.toToken.set(token);
    }
    this.tokenModalOpen.set(null);

    // Update with current input
    this.updateControllerAmount(this.fromAmountInput(), false);
  }

  switchTokens() {
    const from = this.fromToken();
    const to = this.toToken();

    // Swap tokens
    this.fromToken.set(to);
    this.toToken.set(from);

    // Swap the input values - the last entered value moves to the other input
    const fromAmount = this.fromAmountInput();
    const toAmount = this.toAmountInput();
    this.fromAmountInput.set(toAmount);
    this.toAmountInput.set(fromAmount);

    // Recalculate based on the new "from" amount (which was the old "to" amount)
    this.currentIsOutput.set(false);
    this.updateControllerAmount(toAmount, false);
  }

  onMaxClick() {
    this.onPercentageClick(100);
  }

  onPercentageClick(percentage: number) {
    const token = this.fromToken();
    if (!token?.balance) return;

    const balance = token?.balance || 0;
    if (isNaN(balance)) return;

    const amount = ((balance * percentage) / 100).toString();
    this.onFromAmountChange(amount);
  }

  onSettingsSave(settings: SwapSettings) {
    this.currentSettings.set(settings);
    this.controller()?.setData({
      settings: {
        ...DEFAULT_SWAP_SETTINGS,
        ...settings,
      },
    });
    this.settingsOpen.set(false);
  }

  async executeSwap() {
    const ctrl = this.controller();
    if (!ctrl) return;

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
      }
    } catch (err: any) {
      if (err?.code === 4001 || err?.info?.error?.code === 4001) return;
      this.notificationService.error(
        'Swap Failed',
        err?.message || 'Unknown error',
      );
    }
  }
}
