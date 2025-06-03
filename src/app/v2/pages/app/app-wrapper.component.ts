import { Component } from '@angular/core';
import {
  ChildrenOutletContexts,
  RouterModule,
  RouterOutlet,
} from '@angular/router';
import { WrapperHeaderComponent } from './common/wrapper-header/wrapper-header.component';
import { WrapperNavComponent } from './common/wrapper-nav/wrapper-nav.component';
import { navAnimation } from './common/animation/nav.animation';

@Component({
  selector: 'app-app-wrapper',
  imports: [RouterOutlet, WrapperHeaderComponent, WrapperNavComponent],
  templateUrl: './app-wrapper.component.html',
  styleUrl: './app-wrapper.component.scss',
  animations: [navAnimation],
})
export class AppWrapperComponent {
  prepareRoute(outlet: RouterOutlet) {
    return outlet?.activatedRouteData?.['animation'];
  }

  constructor(private contexts: ChildrenOutletContexts) {}

  getRouteAnimationData() {
    return this.contexts.getContext('primary')?.route?.snapshot?.data?.[
      'animation'
    ];
  }
}
