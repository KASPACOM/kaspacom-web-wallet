import { Component } from '@angular/core';
import { KaspaNetworkActionsService } from '../../services/kaspa-netwrok-services/kaspa-network-actions.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss'
})
export class AppHeaderComponent {
  constructor(private readonly kaspaNetworkActionsService: KaspaNetworkActionsService) {}

  getRpcConnectionStatus() {
    // Get the RPC connection status from the wallet service
    return this.kaspaNetworkActionsService.getConnectionStatusSignal();
  }
}
