import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { PasswordManagerService } from './services/password-manager.service';
import { AppHeaderComponent } from './components/app-header/app-header.component';
import { KaspaNetworkActionsService } from './services/kaspa-netwrok-services/kaspa-network-actions.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AppHeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  providers: [KaspaNetworkActionsService]
})
export class AppComponent {
  title = 'kaspiano-wallet';

  constructor(
    private readonly router: Router,
    private readonly passwordManagerService: PasswordManagerService) {
  }

  async ngOnInit() {
    if (this.passwordManagerService.isUserHasSavedPassword()) {
      console.log('User has saved password');

      this.router.navigate(['/login']);
    } else {
      console.log('User has not saved password');
      this.router.navigate(['/set-password']);    
    }
  }

}
