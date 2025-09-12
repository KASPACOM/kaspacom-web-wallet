import { Component, output } from '@angular/core';

@Component({
  selector: 'app-error-new-wallet-step',
  imports: [],
  templateUrl: './error-new-wallet-step.component.html',
  styleUrl: './error-new-wallet-step.component.scss',
})
export class ErrorNewWalletStepComponent {
  next = output<void>();
  previous = output<void>();
}
