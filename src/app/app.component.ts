import { AfterViewInit, Component, OnInit, Renderer2 } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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

  constructor(private renderer: Renderer2) {}

  ngOnInit() {
    // Navigation is now handled by TestInscriptionsGuard
  }

  ngAfterViewInit(): void {
    let loader = this.renderer.selectRootElement('#application-loader-startup');
    if (loader.style.display != "none") loader.style.display = "none"; //hide loader
    loader.remove();
  }
}
