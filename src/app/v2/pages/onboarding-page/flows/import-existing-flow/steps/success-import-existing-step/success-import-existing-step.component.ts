import { Component, output } from '@angular/core';

@Component({
  selector: 'app-success-import-existing-step',
  imports: [],
  templateUrl: './success-import-existing-step.component.html',
  styleUrl: './success-import-existing-step.component.scss',
})
export class SuccessImportExistingStepComponent {
  next = output<void>();
  previous = output<void>();
}
