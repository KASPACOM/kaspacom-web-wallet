import { Component, signal } from '@angular/core';
import { KcButtonComponent } from 'kaspacom-ui';
import { OnboardingStep } from './onboarding-step.enum';
import { ImportExistingFlowComponent } from './flows/import-existing-flow/import-existing-flow.component';
import { NewWalletFlowComponent } from './flows/new-wallet-flow/new-wallet-flow.component';
import {
  SlideDirection,
  slideAnimation,
} from './shared/animation/slide.animation';

@Component({
  selector: 'app-welcome-page',
  imports: [
    KcButtonComponent,
    ImportExistingFlowComponent,
    NewWalletFlowComponent,
  ],
  animations: [slideAnimation],
  templateUrl: './onboarding-page.component.html',
  styleUrl: './onboarding-page.component.scss',
})
export class OnboardingPageComponent {
  readonly OnboardingStep = OnboardingStep;
  readonly SlideDirection = SlideDirection;

  onboardingStep = signal(OnboardingStep.WELCOME);

  startExistingWallet() {
    this.onboardingStep.set(OnboardingStep.IMPORT_EXISTING_WALLET);
  }

  createNewWallet() {
    this.onboardingStep.set(OnboardingStep.NEW_WALLET);
  }
}
