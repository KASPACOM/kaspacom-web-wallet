import { Component } from '@angular/core';
import { KcIconComponent } from 'kaspacom-ui';
import { TitleCasePipe } from '@angular/common';
import { ICryptoAction } from '../../common/interfaces/crypto-actions.interface';
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
  actions: ICryptoAction[] = [
    {
      title: 'receive',
      iconClass: 'icon-chain',
      iconColor: '',
      action: () => {},
    },
    {
      title: 'send',
      iconClass: 'icon-chain',
      iconColor: '',
      action: () => {},
    },
    {
      title: 'swap',
      iconClass: 'icon-chain',
      iconColor: '',
      action: () => {},
    },
  ];
}
