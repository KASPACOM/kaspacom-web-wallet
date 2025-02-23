import { AfterViewInit, Component, Inject, OnInit, Renderer2 } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { PasswordManagerService } from './services/password-manager.service';
import { AppHeaderComponent } from './components/app-header/app-header.component';
import { KaspaNetworkActionsService } from './services/kaspa-netwrok-services/kaspa-network-actions.service';
import { isPlatformBrowser, NgIf } from '@angular/common';
import { IFrameCommunicationService } from './services/iframe-communication.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AppHeaderComponent, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  providers: [KaspaNetworkActionsService]
})
export class AppComponent implements OnInit, AfterViewInit {
  title = 'kaspiano-wallet';


  constructor(
    private readonly router: Router,
    private readonly passwordManagerService: PasswordManagerService,
    private readonly iframeCommunicationService: IFrameCommunicationService,
    private renderer: Renderer2) {
  }

  async ngOnInit() {
    if (!this.isAllowedDomain()) {
      return;
    }

    if (this.iframeCommunicationService.isIframe()) {
      this.iframeCommunicationService.initIframeMessaging();
    }

    if (this.passwordManagerService.isUserHasSavedPassword()) {
      this.router.navigate(['/login']);
    } else {
      this.router.navigate(['/set-password']);
    }
  }

  ngAfterViewInit(): void {
    let loader = this.renderer.selectRootElement('#application-loader-startup');
    if (loader.style.display != "none") loader.style.display = "none"; //hide loader
    loader.remove();
  }

  isAllowedDomain(): boolean {
    const hostname = new URL(window.location.hostname).hostname;
    return environment.allowedDomains.includes(hostname);
  }

  incompatibleBrowserReason(): string | undefined {
    if (!(window.crypto && window.crypto?.subtle)) {
      return 'Crypto not supported';
    }

    return undefined;
  }

}
