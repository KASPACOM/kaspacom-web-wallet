import {Component} from '@angular/core';
import {ButtonComponent} from "../../../design-system";
import {OnboardingStep} from "./onboarding-step.enum";
import {ImportExistingFlowComponent} from "./flows/import-existing-flow/import-existing-flow.component";

@Component({
  selector: 'app-welcome-page',
  standalone: true,
  imports: [
    ButtonComponent,
    ImportExistingFlowComponent
  ],
  templateUrl: './onboarding-page.component.html',
  styleUrl: './onboarding-page.component.scss'
})
export class OnboardingPageComponent {
  onboardingStep = OnboardingStep.WELCOME;
  readonly OnboardingStep = OnboardingStep;

  startExistingWallet() {
    this.onboardingStep = OnboardingStep.IMPORT_EXISTING_WALLET;
  }
}
