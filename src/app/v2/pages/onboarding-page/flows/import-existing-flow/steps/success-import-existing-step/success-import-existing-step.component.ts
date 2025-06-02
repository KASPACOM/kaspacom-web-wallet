import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, inject, output } from '@angular/core';
import { Router } from '@angular/router';
import { KcButtonComponent } from 'kaspacom-ui';

@Component({
  selector: 'app-success-import-existing-step',
  imports: [CommonModule, KcButtonComponent, NgOptimizedImage],
  templateUrl: './success-import-existing-step.component.html',
  styleUrl: './success-import-existing-step.component.scss',
})
export class SuccessImportExistingStepComponent {
  next = output<void>();
  previous = output<void>();

  private readonly router = inject(Router);

  finish() {
    this.router.navigate(['/wallet-selection']);
  }
}
