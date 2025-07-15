import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, ChildrenOutletContexts } from '@angular/router';
import { navAnimation } from './common/animation/nav.animation';
import { WrapperHeaderComponent } from './common/wrapper-header/wrapper-header.component';
import { WrapperNavComponent } from './common/wrapper-nav/wrapper-nav.component';
import { AccountSettingsOverlayComponent } from './common/account-settings-overlay/account-settings-overlay.component';
import { AccountSettingsService } from './common/services/account-settings.service';

@Component({
  selector: 'app-app-wrapper',
  imports: [
    CommonModule,
    RouterOutlet,
    WrapperHeaderComponent,
    WrapperNavComponent,
    AccountSettingsOverlayComponent
  ],
  templateUrl: './app-wrapper.component.html',
  styleUrl: './app-wrapper.component.scss',
  animations: [navAnimation],
})
export class AppWrapperComponent {
  private contexts = inject(ChildrenOutletContexts);
  accountSettingsService = inject(AccountSettingsService);

  getRouteAnimationData() {
    return this.contexts.getContext('primary')?.route?.snapshot?.data?.[
      'animation'
    ];
  }
}
