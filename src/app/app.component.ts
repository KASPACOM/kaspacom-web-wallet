import { AfterViewInit, Component, OnInit } from '@angular/core';
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
export class AppComponent implements OnInit, AfterViewInit {
  title = 'kaspiano-wallet';

  constructor(
    private readonly router: Router,
    private readonly passwordManagerService: PasswordManagerService) {
  }

  async ngOnInit() {
    if (this.passwordManagerService.isUserHasSavedPassword()) {
      this.router.navigate(['/login']);
    } else {
      this.router.navigate(['/set-password']);    
    }
  }

  ngAfterViewInit(): void {
    const applicationLoader = document.getElementById('application-loader-startup');
    if (applicationLoader) {
      applicationLoader.remove();
    }
  }

}
