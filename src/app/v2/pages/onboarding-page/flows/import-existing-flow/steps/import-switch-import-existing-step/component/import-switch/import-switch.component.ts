import { Component, input, output } from '@angular/core';
import { ImportSwitchMethod } from './import-switch-method.enum';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-import-switch',
  imports: [CommonModule],
  templateUrl: './import-switch.component.html',
  styleUrl: './import-switch.component.scss',
})
export class ImportSwitchComponent {
  ImportSwitchMethod = ImportSwitchMethod;

  selectedMethod = input.required<ImportSwitchMethod>();
  showImportFromFile = input<boolean>(false);

  methodChanged = output<ImportSwitchMethod>();
}
