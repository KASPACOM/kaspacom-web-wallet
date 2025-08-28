import {
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
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
import { StepIndicatorComponent } from '../../shared/component/step-indicator/step-indicator.component';
import { NewWalletFlowService } from './service/new-wallet-flow.service';

@Component({
  selector: 'app-new-wallet-flow',
  imports: [
    CreatePasswordNewWalletStepComponent,
    CreateSeedPhraseNewWalletStepComponent,
    AddressNewWalletStepComponent,
    SuccessNewWalletStepComponent,
    ErrorNewWalletStepComponent,
    StepIndicatorComponent,
  ],
  animations: [slideAnimation],
  templateUrl: './new-wallet-flow.component.html',
  styleUrl: './new-wallet-flow.component.scss',
})
export class NewWalletFlowComponent implements OnInit {
  readonly NewWalletStep = NewWalletStep;

  private readonly newWalletFlowService = inject(NewWalletFlowService);

  skipPassword = input<boolean>(false);

  readonly stepOrder = [
    NewWalletStep.CREATE_PASSWORD,
    NewWalletStep.CREATE_SEED_PHRASE,
    NewWalletStep.ADDRESS,
  ];
  slideDirection = signal<SlideDirection>(SlideDirection.FORWARD);

  onboardingStep = signal(NewWalletStep.CREATE_PASSWORD);

  currentIndex = computed(() => this.stepOrder.indexOf(this.onboardingStep()));

  ngOnInit(): void {
    this.newWalletFlowService.initNewWallet();

    // If coming from Change Wallet flow, skip password step
    if (this.skipPassword()) {
      const idx = this.stepOrder.indexOf(NewWalletStep.CREATE_PASSWORD);
      if (idx !== -1) {
        this.stepOrder.splice(idx, 1);
        // Reset current step to first available
        this.onboardingStep.set(this.stepOrder[0]);
      }
    }
  }

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
