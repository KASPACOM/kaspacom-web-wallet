import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { WalletService } from '../../services/wallet.service'; // Assume you have a service to fetch wallets
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, NgFor, NgIf, Time } from '@angular/common';
import { AppWallet } from '../../classes/AppWallet';
import { firstValueFrom, map, tap } from 'rxjs';
import { KasplexKrc20Service } from '../../services/kasplex-api/kasplex-api.service';
import { KaspaNetworkActionsService } from '../../services/kaspa-netwrok-services/kaspa-network-actions.service';
import { SompiToNumberPipe } from '../../pipes/sompi-to-number.pipe';
import { SendAssetComponent } from '../../components/send-asset/send-asset.component';
import { ReviewActionComponent } from '../../components/review-action/review-action.component';
import { WalletActionService } from '../../services/wallet-action.service';
import { MintComponent } from '../../components/mint/mint.component';
import { KaspaApiService } from '../../services/kaspa-api/kaspa-api.service';
import {
  FullTransactionResponse,
  FullTransactionResponseItem,
} from '../../services/kaspa-api/dtos/full-transaction-response.dto';
import { UnfinishedKrc20Action } from '../../types/kaspa-network/unfinished-krc20-action.interface';
import { ListKrc20Component } from '../../components/list-krc20-component/list-krc20-component.component';
import { BuyKrc20Component } from '../../components/buy-krc20-component/buy-krc20.component';
import { DeployComponent } from '../../components/deploy/deploy.component';

type ActionTabs = 'send' | 'mint' | 'deploy' | 'list' | 'buy';

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
  protected kaspaTransactionsHistoryMapped:
    | undefined
    | {
        id: string;
        senders: Record<string, bigint>;
        receivers: Record<string, bigint>;
        totalForThisWallet: bigint;
        date: Date;
        confirmed: boolean;
      }[] = undefined;

  private paginationPrevTokenKey?: string | null;
  private paginationNextTokenKey?: string | null;
  private paginationDirection?: 'next' | 'prev' | null;

  protected activeTab: ActionTabs = 'deploy'; // Default to Send Asset tab
  protected infoActiveTab: 'utxos' | 'kaspa-transactions' = 'utxos';

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

    const tokens: { ticker: string; balance: number }[] = await firstValueFrom(
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
          })
        )
    );

    this.tokens = tokens;
  }

  async loadUserTransactions() {
    this.kaspaTransactionsHistory = await firstValueFrom(
      this.kaspaApiService.getFullTransactions(this.wallet!.getAddress())
    );

    this.kaspaTransactionsHistoryMapped = this.kaspaTransactionsHistory.map(
      (tx) => this.transformTransactionData(tx)
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

  switchInfoTab(tab: 'utxos' | 'kaspa-transactions') {
    this.infoActiveTab = tab;
  }

  transformTransactionData(transaction: FullTransactionResponseItem): {
    id: string;
    senders: Record<string, bigint>;
    receivers: Record<string, bigint>;
    totalForThisWallet: bigint;
    date: Date;
    confirmed: boolean;
  } {
    const senders = transaction.inputs.reduce((acc, input) => {
      const address = input.previous_outpoint_address;
      if (!acc[address]) {
        acc[address] = BigInt(0);
      }
      acc[address] += BigInt(input.previous_outpoint_amount);
      return acc;
    }, {} as Record<string, bigint>);

    const receivers = transaction.outputs.reduce((acc, output) => {
      const address = output.script_public_key_address;
      if (!acc[address]) {
        acc[address] = BigInt(0);
      }
      acc[address] += BigInt(output.amount);
      return acc;
    }, {} as Record<string, bigint>);

    const totalForThisWallet =
      (receivers[this.wallet!.getAddress()] || BigInt(0)) -
      (senders[this.wallet!.getAddress()] || BigInt(0));

    delete senders[this.wallet!.getAddress()];
    delete receivers[this.wallet!.getAddress()];

    const walletsInBoth = Object.keys(senders).filter(
      (address) => !!receivers[address]
    );

    for (const address of walletsInBoth) {
      senders[address] = senders[address] - receivers[address];
      delete receivers[address];
    }

    return {
      id: transaction.transaction_id,
      senders,
      receivers,
      totalForThisWallet,
      date: new Date(transaction.block_time),
      confirmed: transaction.is_accepted,
    };
  }

  async loadData() {
    try {
      await Promise.all([this.loadKrc20Tokens(), this.loadUserTransactions()]);
    } catch (error) {
      console.error(error);
    }

    this.refreshDataTimeout = setTimeout(() => {
      this.loadData();
    }, 20 * 1000);
  }

  async compoundUtxos() {
    await this.walletActionService.validateAndDoActionAfterApproval(
      this.walletActionService.createCompoundUtxosAction()
    );
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
