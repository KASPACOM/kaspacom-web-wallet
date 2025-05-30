import { Component, output } from '@angular/core';

@Component({
  selector: 'app-import-switch-import-existing-step',
  imports: [],
  templateUrl: './import-switch-import-existing-step.component.html',
  styleUrl: './import-switch-import-existing-step.component.scss',
})
export class ImportSwitchImportExistingStepComponent {
  next = output<void>();
  previous = output<void>();
}
