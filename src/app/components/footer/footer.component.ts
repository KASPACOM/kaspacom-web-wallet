import { Component, signal } from '@angular/core';
import { KcIconComponent } from 'kaspacom-ui';
import { IFooterAction } from '../../interfaces/crypto-action.interface';

@Component({
  selector: 'app-footer',
  imports: [KcIconComponent],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  selectedRoute = signal<string | undefined>('home');
  actions: IFooterAction[] = [];

  constructor() {
    this.actions = [
      {
        title: 'home',
        iconClass: 'icon-add',
        iconColor: '',
        action: this.goTo,
      },
      {
        title: 'swap',
        iconClass: 'icon-add',
        iconColor: '',
        action: this.goTo,
      },
      {
        title: 'activity',
        iconClass: 'icon-add',
        iconColor: '',
        action: this.goTo,
      },
      {
        title: 'search',
        iconClass: 'icon-add',
        iconColor: '',
        action: this.goTo,
      },
    ];
  }

  goTo = (route: string) => {
    this.selectedRoute.set(route);
    console.log('go to ', route);
  };
}
