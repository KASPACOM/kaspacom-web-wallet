import { Component, output } from '@angular/core';

@Component({
  selector: 'app-create-pin-import-existing-step',
  imports: [],
  templateUrl: './create-pin-import-existing-step.component.html',
  styleUrl: './create-pin-import-existing-step.component.scss',
})
export class CreatePinImportExistingStepComponent {
  next = output<void>();
  previous = output<void>();
}
