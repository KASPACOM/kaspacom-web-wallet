import { Component, output } from '@angular/core';

@Component({
  selector: 'app-success-new-wallet-step',
  imports: [],
  templateUrl: './success-new-wallet-step.component.html',
  styleUrl: './success-new-wallet-step.component.scss',
})
export class SuccessNewWalletStepComponent {
  next = output<void>();
  previous = output<void>();
}
