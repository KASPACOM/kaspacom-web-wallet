import { Component, inject } from '@angular/core';
import { KcIconComponent } from 'kaspacom-ui';
import { TitleCasePipe } from '@angular/common';
import { ICryptoAction } from '../../common/interfaces/crypto-actions.interface';
import { FlowPagesService } from '../../common/services/flow-pages.service';
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

  actions: ICryptoAction[] = [
    {
      title: 'send',
      iconClass: 'icon-arrow-up',
      iconColor: '',
      action: () => this.openSendPage(),
    },
    {
      title: 'receive',
      iconClass: 'icon-arrow-down',
      iconColor: '',
      action: () => this.openReceivePage(),
    },
  ];

  private openReceivePage(): void {
    // TODO: Implement receive page
    console.log('Open receive page');
  }

  private openSendPage(): void {
    this.flowPagesService.openFlow({
      id: 'send',
      title: 'Send',
      canNavigateBack: true
    });
  }


}
