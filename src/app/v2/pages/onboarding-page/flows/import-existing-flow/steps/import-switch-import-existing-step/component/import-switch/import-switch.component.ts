import { Component, computed, input, output } from '@angular/core';
import { KcSwitchComponent, SwitchOption } from '@kaspacom/ui-kit';
import { ImportSwitchMethod } from './import-switch-method.enum';

@Component({
  selector: 'app-import-switch',
  imports: [KcSwitchComponent],
  templateUrl: './import-switch.component.html',
  styleUrl: './import-switch.component.scss',
})
export class ImportSwitchComponent {
  selectedMethod = input.required<ImportSwitchMethod>();
  showImportFromFile = input<boolean>(false);

  methodChanged = output<ImportSwitchMethod>();

  options = computed<SwitchOption[]>(() => [
    { label: 'Seed Phrase', value: ImportSwitchMethod.SEED_PHRASE },
    { label: 'Private Key', value: ImportSwitchMethod.PRIVATE_KEY },
    ...(this.showImportFromFile()
      ? [{ label: 'Backup File', value: ImportSwitchMethod.BACKUP }]
      : []),
  ]);

  onSelectionChange(option: SwitchOption) {
    this.methodChanged.emit(option.value as ImportSwitchMethod);
  }
}
