import { Component, signal } from '@angular/core';
import { NewWalletStep } from './new-wallet-step.enum';
import {
  SlideDirection,
  slideAnimation,
} from '../../shared/animation/slide.animation';
import { CreatePasswordNewWalletStepComponent } from './steps/create-password-new-wallet-step/create-password-new-wallet-step.component';
import { CreateSeedPhraseNewWalletStepComponent } from './steps/create-seed-phrase-new-wallet-step/create-seed-phrase-new-wallet-step.component';
import { AddressNewWalletStepComponent } from './steps/address-new-wallet-step/address-new-wallet-step.component';
import { SuccessNewWalletStepComponent } from './steps/success-new-wallet-step/success-new-wallet-step.component';
import { ErrorNewWalletStepComponent } from './steps/error-new-wallet-step/error-new-wallet-step.component';

@Component({
  selector: 'app-new-wallet-flow',
  imports: [
    CreatePasswordNewWalletStepComponent,
    CreateSeedPhraseNewWalletStepComponent,
    AddressNewWalletStepComponent,
    SuccessNewWalletStepComponent,
    ErrorNewWalletStepComponent,
  ],
  animations: [slideAnimation],
  templateUrl: './new-wallet-flow.component.html',
  styleUrl: './new-wallet-flow.component.scss',
})
export class NewWalletFlowComponent {
  readonly NewWalletStep = NewWalletStep;

  readonly stepOrder = [
    NewWalletStep.CREATE_PASSWORD,
    NewWalletStep.CREATE_SEED_PHRASE,
    NewWalletStep.ADDRESS,
  ];
  slideDirection = signal<SlideDirection>(SlideDirection.FORWARD);

  onboardingStep = signal(NewWalletStep.CREATE_PASSWORD);

  next() {
    const currentIndex = this.stepOrder.indexOf(this.onboardingStep());
    if (currentIndex < this.stepOrder.length - 1) {
      this.slideDirection.set(SlideDirection.FORWARD);
      this.onboardingStep.set(this.stepOrder[currentIndex + 1]);
    }
  }

  previous() {
    const currentIndex = this.stepOrder.indexOf(this.onboardingStep());
    if (currentIndex > 0) {
      this.slideDirection.set(SlideDirection.BACKWARD);
      this.onboardingStep.set(this.stepOrder[currentIndex - 1]);
    }
  }
}
