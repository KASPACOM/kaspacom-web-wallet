import { CommonModule } from '@angular/common';
import { Component, output } from '@angular/core';
import { KcButtonComponent } from 'kaspacom-ui';

@Component({
  selector: 'app-success-import-existing-step',
  imports: [CommonModule, KcButtonComponent],
  templateUrl: './success-import-existing-step.component.html',
  styleUrl: './success-import-existing-step.component.scss',
})
export class SuccessImportExistingStepComponent {
  next = output<void>();
  previous = output<void>();
}
