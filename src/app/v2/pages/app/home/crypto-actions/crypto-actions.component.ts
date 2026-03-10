import { Component, inject, computed } from '@angular/core';
import { KcIconComponent } from 'kaspacom-ui';
import { TitleCasePipe } from '@angular/common';
import { ICryptoAction } from '../../common/interfaces/crypto-actions.interface';
import { FlowPagesService } from '../../../../services/flow-pages.service';
import { WalletService } from '../../../../../services/wallet.service';
@Component({
  selector: 'app-crypto-actions',
  imports: [KcIconComponent, TitleCasePipe],
  templateUrl: './crypto-actions.component.html',
  styleUrl: './crypto-actions.component.scss',
  host: {
    '[class.full-width]': 'true',
  },
})
export class CryptoActionsComponent {
  private flowPagesService = inject(FlowPagesService);
  private walletService = inject(WalletService);

  actions = computed<ICryptoAction[]>(() => {
    const baseActions: ICryptoAction[] = [
      {
        title: 'send',
        iconClass: 'icon-arrow-up',
        iconColor: '',
        action: () => this.openSendPage(),
      },
      {
        title: 'receive',
        iconClass: 'icon-qr',
        iconColor: '',
        action: () => this.openReceivePage(),
      },
    ];

    if (this.walletService.getIsL2DisplaySignal()()) {
      baseActions.push({
        title: 'swap',
        iconClass: 'icon-refresh',
        iconColor: '',
        action: () => this.openSwapPage(),
      });
    }

    return baseActions;
  });

  private openReceivePage(): void {
    this.flowPagesService.openFlow({
      id: 'receive',
      title: 'Receive',
      canNavigateBack: true
    });
  }

  private openSendPage(): void {
    this.flowPagesService.openFlow({
      id: 'send',
      title: 'Send',
      canNavigateBack: true
    });
  }

  private openSwapPage(): void {
    this.flowPagesService.openFlow({
      id: 'swap',
      title: 'Swap',
      canNavigateBack: true
    });
  }


}
