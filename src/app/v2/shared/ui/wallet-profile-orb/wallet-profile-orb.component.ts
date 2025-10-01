import { Component, computed, inject } from '@angular/core';
import { NetworkSelectionService } from '../../../../services/network-selection.service';

@Component({
  selector: 'app-wallet-profile-orb',
  standalone: true,
  imports: [],
  template: `<div
    class="wallet-profile-orb"
    [class]="'wallet-profile-orb--' + networkType()"
  ></div>`,
  styleUrl: './wallet-profile-orb.component.scss',
})
export class WalletProfileOrbComponent {
  private networkSelectionService = inject(NetworkSelectionService);

  networkType = computed(() => {
    const currentNetwork = this.networkSelectionService.getCurrentNetwork();
    return currentNetwork === 'l1-kaspa' ? 'l1' : 'l2';
  });
}
