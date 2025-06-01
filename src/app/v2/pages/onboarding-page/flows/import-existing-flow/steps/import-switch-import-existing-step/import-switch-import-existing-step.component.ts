import { CommonModule } from '@angular/common';
import { Component, computed, output, signal } from '@angular/core';
import { KcButtonComponent, KcInputComponent } from 'kaspacom-ui';
import { ImportSwitchComponent } from './component/import-switch/import-switch.component';
import { ImportSwitchMethod } from './component/import-switch/import-switch-method.enum';
import { RadioInputComponent } from '../../../../../../shared/ui/input/radio/radio-input/radio-input.component';

@Component({
  selector: 'app-import-switch-import-existing-step',
  imports: [
    CommonModule,
    KcButtonComponent,
    ImportSwitchComponent,
    RadioInputComponent,
    KcInputComponent,
  ],
  templateUrl: './import-switch-import-existing-step.component.html',
  styleUrl: './import-switch-import-existing-step.component.scss',
})
export class ImportSwitchImportExistingStepComponent {
  next = output<void>();
  previous = output<void>();

  ImportSwitchMethod = ImportSwitchMethod;

  importMethod = signal<ImportSwitchMethod>(ImportSwitchMethod.SEED_PHRASE);

  wordSpots = computed(() =>
    Array.from({ length: this.wordCount() }, (_, i) => ''),
  );

  wordCount = signal<number>(12);

  onWordCountChange(count: number): void {
    this.wordCount.set(count);
  }

  onImportMethodChange(method: ImportSwitchMethod): void {
    this.importMethod.set(method);
  }

  onChangeSeedPhraseWord(value: string, idx: number) {
    this.wordSpots()[idx] = value;
  }
}
