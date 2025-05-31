import { CommonModule } from '@angular/common';
import { Component, output } from '@angular/core';
import { KcButtonComponent } from 'kaspacom-ui';

@Component({
  selector: 'app-import-switch-import-existing-step',
  imports: [CommonModule, KcButtonComponent],
  templateUrl: './import-switch-import-existing-step.component.html',
  styleUrl: './import-switch-import-existing-step.component.scss',
})
export class ImportSwitchImportExistingStepComponent {
  next = output<void>();
  previous = output<void>();
}
