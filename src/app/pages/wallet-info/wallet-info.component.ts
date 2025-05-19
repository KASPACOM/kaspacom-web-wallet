import {
  Component,
  computed,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { WalletService } from '../../services/wallet.service'; // Assume you have a service to fetch wallets
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, NgFor, NgIf, Time } from '@angular/common';
import { AppWallet } from '../../classes/AppWallet';
import { catchError, firstValueFrom, map, of, tap } from 'rxjs';
import { KasplexKrc20Service } from '../../services/kasplex-api/kasplex-api.service';
import { KaspaNetworkActionsService } from '../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { SompiToNumberPipe } from '../../pipes/sompi-to-number.pipe';
import { SendAssetComponent } from '../../components/wallet-actions-forms/send-asset/send-asset.component';
import { ReviewActionComponent } from '../../components/wallet-actions-reviews/review-action/review-action.component';
import { WalletActionService } from '../../services/wallet-action.service';
import { MintComponent } from '../../components/wallet-actions-forms/mint/mint.component';
import { KaspaApiService } from '../../services/kaspa-api/kaspa-api.service';
import { FullTransactionResponse } from '../../services/kaspa-api/dtos/full-transaction-response.dto';
import { UnfinishedCommitRevealAction } from '../../types/kaspa-network/unfinished-commit-reveal-action.interface';
import { ListKrc20Component } from '../../components/wallet-actions-forms/list-krc20-component/list-krc20-component.component';
import { BuyKrc20Component } from '../../components/wallet-actions-forms/buy-krc20-component/buy-krc20.component';
import { DeployComponent } from '../../components/wallet-actions-forms/deploy/deploy.component';
import { UtxosListComponent } from '../../components/history-info-components/utxos-list/utxos-list.component';
import { TransactionHistoryComponent } from '../../components/history-info-components/transaction-history/transaction-history.component';
import { Krc20OperationHistoryComponent } from '../../components/history-info-components/krc20-operation-history/krc20-operation-history.component';
import { OperationDetails } from '../../services/kasplex-api/dtos/operation-details-response';
import { MempoolTransactionsComponent } from '../../components/history-info-components/mempool-transactions/mempool-transactions.component';
import { EIP1193ProviderChain } from 'kaspacom-wallet-messages';
import { AddL2ChainComponent } from '../../components/wallet-actions-forms/add-l2-chain/add-l2-chain.component';
import { L2TransactionComponent } from '../../components/wallet-actions-forms/l2-transaction/l2-transaction.component';
import { toObservable } from '@angular/core/rxjs-interop';
import { EthereumWalletChainManager } from '../../services/etherium-services/etherium-wallet-chain.manager';
import { environment } from '../../../environments/environment';

type ActionTabs = 'send' | 'mint' | 'deploy' | 'list' | 'buy' | 'kasplex-l2';
type InfoTabs = 'utxos' | 'kaspa-transactions' | 'krc20-actions';

@Component({
  selector: 'wallet-info',
  standalone: true,
  templateUrl: './wallet-info.component.html',
  styleUrls: ['./wallet-info.component.scss'],
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NgIf,
    NgFor,
    SompiToNumberPipe,
    SendAssetComponent,
    MintComponent,
    ReviewActionComponent,
    CommonModule,
    ListKrc20Component,
    BuyKrc20Component,
    DeployComponent,
    UtxosListComponent,
    TransactionHistoryComponent,
    Krc20OperationHistoryComponent,
    MempoolTransactionsComponent,
    AddL2ChainComponent,
    L2TransactionComponent,
  ],
})
export class WalletInfoComponent implements OnInit, OnDestroy {
  @ViewChild('reviewActionComponent')
  reviewActionComponent!: ReviewActionComponent;

  protected wallet: AppWallet | undefined = undefined;
  protected tokens: undefined | { ticker: string; balance: number }[] =
    undefined;

  protected unfinishedAction: undefined | UnfinishedCommitRevealAction = undefined;
  protected canCompleteUnfinishedAction: boolean = false;

  protected kaspaTransactionsHistory: undefined | FullTransactionResponse =
    undefined;

  protected krc20OperationHistory: undefined | OperationDetails[] = undefined;

  private paginationPrevTokenKey?: string | null;
  private paginationNextTokenKey?: string | null;
  private paginationDirection?: 'next' | 'prev' | null;

  protected activeTab: ActionTabs = 'send'; // Default to Send Asset tab
  protected infoActiveTab: InfoTabs = 'utxos';

  private refreshDataTimeout: NodeJS.Timeout | undefined;
  private setUnfinishedActionsTimeout: NodeJS.Timeout | undefined;

  protected kasplexL2Address: string | undefined = undefined;
  protected kasplexL2Balance: bigint | undefined = undefined;

  protected selectedChain: string | undefined;
  protected availableChains: EIP1193ProviderChain[] = [];

  protected isAddChainFormVisible = false;

  constructor(
    private walletService: WalletService, // Inject wallet service
    private router: Router,
    private kasplexService: KasplexKrc20Service,
    private kaspaNetworkActionsService: KaspaNetworkActionsService,
    private walletActionService: WalletActionService,
    private kaspaApiService: KaspaApiService,
    private ethereumWalletChainManager: EthereumWalletChainManager,
  ) {
    toObservable(this.ethereumWalletChainManager.getCurrentChainSignal()).subscribe((chain) => {
      this.selectedChain = chain;
    });
  }

  walletUtxoStateBalanceSignal = computed(() => this.wallet?.getCurrentWalletStateBalanceSignalValue());
  currentL2Chain = computed(() => this.ethereumWalletChainManager.getCurrentChainSignal()());
  isL2Enabled = environment.isL2Enabled;

  l2WalletInfo = computed(() => this.wallet?.getL2WalletStateSignal()());
  l2WalletInfoFormatted = computed(() => {
    return this.l2WalletInfo() ? {
      address: this.l2WalletInfo()?.address,
      balance: this.l2WalletInfo()?.balanceFormatted + ' ' + this.wallet?.getL2Provider()?.getConfig().nativeCurrency.symbol,
    } : undefined;
  });

  ngOnInit(): void {
    this.wallet = this.walletService.getCurrentWallet();

    if (!this.wallet) {
      this.router.navigate(['/wallet-selection']);
      return;
    }

    this.initializeL2Networks();
    this.loadData();
    this.checkForUnfinishedActions();
  }

  ngOnDestroy(): void {
    if (this.refreshDataTimeout) {
      clearTimeout(this.refreshDataTimeout);
      clearTimeout(this.setUnfinishedActionsTimeout);
    }
  }

  private initializeL2Networks() {
    const chainsByChainId = this.ethereumWalletChainManager.getAllChainsByChainId();
    this.availableChains = Object.values(chainsByChainId);
    
    // Set initial selected chain
    const currentChain = this.currentL2Chain();
    this.selectedChain = currentChain;
  }

  protected onChainChange() {
    this.ethereumWalletChainManager.setCurrentChain(this.selectedChain == 'undefined' ? undefined : this.selectedChain);
  }

  async loadKrc20Tokens() {
    const paginationKey =
      this.paginationDirection === 'next'
        ? this.paginationNextTokenKey
        : this.paginationPrevTokenKey;

    this.tokens = await firstValueFrom(
      this.kasplexService
        .getWalletTokenList(
          this.wallet!.getAddress(),
          paginationKey,
          this.paginationDirection
        )
        .pipe(
          tap((response) => {
            this.paginationPrevTokenKey = response.prev;
            this.paginationNextTokenKey = response.next;
          }),
          map((response) => {
            return response.result.map((token) => ({
              ticker: token.tick,
              balance: this.kaspaNetworkActionsService.sompiToNumber(
                BigInt(+token.balance)
              ),
            }));
          }),
          catchError((err) => {
            console.error(
              `Error fetching token list for address ${this.wallet!.getAddress()}:`,
              err
            );

            return of(undefined);
          })
        )
    );
  }

  async loadKrc20Operations() {
    this.krc20OperationHistory = await firstValueFrom(
      this.kasplexService
        .getWalletOperationHistory(
          this.wallet!.getAddress(),
        )
        .pipe(
          map((response) => {
            return response.result;
          }),
          catchError((err) => {
            console.error(
              `Error fetching krc20 operation list for address ${this.wallet!.getAddress()}:`,
              err
            );

            return of(undefined);
          })
        )
    );
  }

  async loadUserTransactions() {
    this.kaspaTransactionsHistory = await firstValueFrom(
      this.kaspaApiService.getFullTransactions(this.wallet!.getAddress()).pipe(
        catchError((err) => {
          console.error(
            `Error fetching transactions list for address ${this.wallet!.getAddress()}:`,
            err
          );

          return of(undefined);
        })
      )
    );
  }

  getPagesTransactions(itemsPerPage: number = 50): FullTransactionResponse {
    if (this.kaspaTransactionsHistory) {
      return this.kaspaTransactionsHistory.slice(0, itemsPerPage);
    }

    return [];
  }

  goToSelectWallet() {
    this.router.navigate(['/wallet-selection']);
  }

  switchTab(tab: ActionTabs) {
    this.activeTab = tab;
  }

  switchInfoTab(tab: InfoTabs) {
    this.infoActiveTab = tab;
  }

  async loadData() {
    try {
      await Promise.all([
        this.loadKrc20Tokens(),
        this.loadUserTransactions(),
        this.loadKrc20Operations(),
      ]);
    } catch (error) {
      console.error(error);
    }

    this.refreshDataTimeout = setTimeout(() => {
      this.loadData();
    }, 20 * 1000);
  }

  async checkForUnfinishedActions() {
    try {
      const unfinishedAction = await this.kaspaNetworkActionsService.getWalletUnfinishedActions(
        this.wallet!
      );

      if (unfinishedAction) {
        this.canCompleteUnfinishedAction = await this.checkIfCanFinishUnfinishedAction(unfinishedAction);
      }
      this.unfinishedAction = unfinishedAction;

    } catch (error) {
      console.error(error);
    }

    this.setUnfinishedActionsTimeout = setTimeout(() => {
      this.checkForUnfinishedActions();
    }, 60 * 1000);
  }

  async checkIfCanFinishUnfinishedAction(unfinishedAction: UnfinishedCommitRevealAction): Promise<boolean> {
    const result = await this.walletActionService.validateAction(
      this.walletActionService.createUnfinishedCommitRevealAction(
        unfinishedAction.operationData,
        true,
      ),
      this.walletService.getCurrentWallet()!,
      true,
    )

    return result.isValidated;
  }

  async finishUnfinishedAction(shouldFinish?: boolean) {
    if (!this.unfinishedAction) {
      return;
    }

    await this.walletActionService.validateAndDoActionAfterApproval(
      this.walletActionService.createUnfinishedCommitRevealAction(
        this.unfinishedAction!.operationData,
        shouldFinish
      )
    );

    this.checkForUnfinishedActions();
  }

  protected showAddChainForm() {
    this.isAddChainFormVisible = true;
  }

  protected hideAddChainForm() {
    this.isAddChainFormVisible = false;
  }

  protected onChainAdded(chain: EIP1193ProviderChain) {
    this.ethereumWalletChainManager.addChain(chain);
    this.initializeL2Networks();
    this.selectedChain = chain.chainId;
    this.onChainChange();
    this.hideAddChainForm();
  }
}
