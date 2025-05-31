import { CommonModule } from '@angular/common';
import { Component, output } from '@angular/core';
import { KcButtonComponent } from 'kaspacom-ui';

@Component({
  selector: 'app-create-pin-import-existing-step',
  imports: [CommonModule, KcButtonComponent],
  templateUrl: './create-pin-import-existing-step.component.html',
  styleUrl: './create-pin-import-existing-step.component.scss',
})
export class CreatePinImportExistingStepComponent {
  next = output<void>();
  previous = output<void>();
}
