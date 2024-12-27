import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { WalletAction, WalletActionType } from '../../types/wallet-action';
import { KRC20OperationType } from '../../types/kaspa-network/krc20-operations-data.interface';
import { WalletService } from '../../services/wallet.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { first } from 'rxjs';
import { CommonModule, NgFor, NgIf } from '@angular/common';
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
import { UnfinishedKrc20Action } from '../../types/kaspa-network/unfinished-krc20-action.interface';
import { ListKrc20Component } from '../../components/wallet-actions-forms/list-krc20-component/list-krc20-component.component';
import { BuyKrc20Component } from '../../components/wallet-actions-forms/buy-krc20-component/buy-krc20.component';
import { DeployComponent } from '../../components/wallet-actions-forms/deploy/deploy.component';
import { UtxosListComponent } from '../../components/history-info-components/utxos-list/utxos-list.component';
import { TransactionHistoryComponent } from '../../components/history-info-components/transaction-history/transaction-history.component';
import { Krc20OperationHistoryComponent } from '../../components/history-info-components/krc20-operation-history/krc20-operation-history.component';
import { OperationDetails } from '../../services/kasplex-api/dtos/operation-details-response';

type ActionTabs = 'send' | 'mint' | 'deploy' | 'list' | 'buy';
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
  ],
})
export class WalletInfoComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('reviewActionComponent')
  reviewActionComponent!: ReviewActionComponent;

  protected wallet: AppWallet | undefined = undefined;
  protected tokens: undefined | { ticker: string; balance: number }[] =
    undefined;

  protected unfinishedAction: undefined | UnfinishedKrc20Action = undefined;

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

  constructor(
    private walletService: WalletService, // Inject wallet service
    private router: Router,
    private kasplexService: KasplexKrc20Service,
    private kaspaNetworkActionsService: KaspaNetworkActionsService,
    private walletActionService: WalletActionService,
    private kaspaApiService: KaspaApiService
  ) {}

  ngOnInit(): void {
    this.wallet = this.walletService.getCurrentWallet();

    if (!this.wallet) {
      this.router.navigate(['/wallet-selection']);
      return;
    }

    this.loadData();
    this.checkForUnfinishedActions();
  }

  ngOnDestroy(): void {
    if (this.refreshDataTimeout) {
      clearTimeout(this.refreshDataTimeout);
      clearTimeout(this.setUnfinishedActionsTimeout);
    }
  }

  ngAfterViewInit(): void {
    this.walletActionService.registerViewingComponent(
      this.reviewActionComponent
    );
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
          // tap((response) => {
          //   this.paginationPrevTokenKey = response.prev;
          //   this.paginationNextTokenKey = response.next;
          // }),
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
      this.unfinishedAction =
        await this.kaspaNetworkActionsService.getWalletUnfinishedActions(
          this.wallet!
        );
    } catch (error) {
      console.error(error);
    }

    this.setUnfinishedActionsTimeout = setTimeout(() => {
      this.checkForUnfinishedActions();
    }, 60 * 1000);
  }

  async finishUnfinishedAction() {
    if (!this.unfinishedAction) {
      return;
    }

    await this.walletActionService.validateAndDoActionAfterApproval(
      this.walletActionService.createUnfinishedKrc20Action(
        this.unfinishedAction!.operationData!
      )
    );

    this.checkForUnfinishedActions();
  }
}
