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
import { KasplexL2TransactionComponent } from '../../components/wallet-actions-forms/kasplex-l2-transaction/kasplex-l2-transaction.component';
import { WeiToNumberPipe } from '../../pipes/wei-to-number.pipe';
import { Krc20AssetsComponent } from '../../components/wallet-assets/krc20-assets/krc20-assets.component';
import { KnsAssetsComponent } from '../../components/wallet-assets/kns-assets/kns-assets.component';
import { Krc721AssetsComponent } from '../../components/wallet-assets/krc721-assets/krc721-assets.component';

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
    WeiToNumberPipe,
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
    KasplexL2TransactionComponent,
    Krc20AssetsComponent,
    KnsAssetsComponent,
    Krc721AssetsComponent,
  ],
})
export class WalletInfoComponent implements OnInit, OnDestroy {
  @ViewChild('reviewActionComponent')
  reviewActionComponent!: ReviewActionComponent;

  protected wallet: AppWallet | undefined = undefined;

  protected unfinishedAction: undefined | UnfinishedCommitRevealAction = undefined;
  protected canCompleteUnfinishedAction: boolean = false;

  protected kaspaTransactionsHistory: undefined | FullTransactionResponse =
    undefined;

  protected krc20OperationHistory: undefined | OperationDetails[] = undefined;

  protected activeTab: ActionTabs = 'send';
  protected infoActiveTab: InfoTabs = 'utxos';
  protected activeAssetsTab = 'krc20';
  protected refreshAssetsTrigger = 0;

  private refreshDataTimeout: NodeJS.Timeout | undefined;
  private setUnfinishedActionsTimeout: NodeJS.Timeout | undefined;

  protected kasplexL2Address: string | undefined = undefined;
  protected kasplexL2Balance: bigint | undefined = undefined;
  constructor(
    private walletService: WalletService, // Inject wallet service
    private router: Router,
    private kasplexService: KasplexKrc20Service,
    private kaspaNetworkActionsService: KaspaNetworkActionsService,
    private walletActionService: WalletActionService,
    private kaspaApiService: KaspaApiService,
  ) {}

  walletUtxoStateBalanceSignal = computed(() => this.wallet?.getCurrentWalletStateBalanceSignalValue());


  async ngOnInit(): Promise<void> {
    this.wallet = this.walletService.getCurrentWallet();

    if (!this.wallet) {
      this.router.navigate(['/wallet-selection']);
      return;
    }

    this.loadData();
    this.checkForUnfinishedActions();
    this.setKasplexL2ServiceAddress();
  }

  ngOnDestroy(): void {
    if (this.refreshDataTimeout) {
      clearTimeout(this.refreshDataTimeout);
      clearTimeout(this.setUnfinishedActionsTimeout);
    }
  }

  async loadKasplexL2Balance() {
    if (this.kasplexL2Address) {
      this.kasplexL2Balance = await this.wallet?.getKasplexL2ServiceBalance();
    }
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

  async loadKaspaTransactionsHistory() {
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

  switchAssetsTab(tab: string) {
    this.activeAssetsTab = tab;
  }

  refreshAssets() {
    this.refreshAssetsTrigger++;
  }

  async loadData() {
    try {
      await Promise.all([
        this.loadKaspaTransactionsHistory(),
        this.loadKrc20Operations(),
        this.loadKasplexL2Balance(),
      ]);
    } catch (error) {
      console.error(error);
    }

    this.refreshDataTimeout = setTimeout(() => {
      this.loadData();
    }, 10000);
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

  async setKasplexL2ServiceAddress() {
    if (!this.wallet) {
      return;
    }

    this.kasplexL2Address = await this.wallet.getKasplexL2ServiceWallet().getAddress();
    this.loadKasplexL2Balance();
  }
}
