import { CommonModule } from '@angular/common';
import { Component, inject, output, signal } from '@angular/core';
import { KcButtonComponent } from '@kaspacom/ui';
import { ImportSwitchComponent } from './component/import-switch/import-switch.component';
import { ImportSwitchMethod } from './component/import-switch/import-switch-method.enum';
import { ImportExistingFlowService } from '../../service/import-existing-flow.service';

@Component({
  selector: 'app-import-switch-import-existing-step',
  imports: [CommonModule, KcButtonComponent, ImportSwitchComponent],
  templateUrl: './import-switch-import-existing-step.component.html',
  styleUrl: './import-switch-import-existing-step.component.scss',
})
export class ImportSwitchImportExistingStepComponent {
  next = output<void>();

  ImportSwitchMethod = ImportSwitchMethod;

  private readonly importExistingFlowService = inject(
    ImportExistingFlowService,
  );

  importMethod = signal<ImportSwitchMethod>(ImportSwitchMethod.SEED_PHRASE);

  constructor() {
    this.importMethod.set(
      this.importExistingFlowService.model().importSwitchMethod,
    );
  }

  onImportMethodChange(method: ImportSwitchMethod): void {
    this.importMethod.set(method);
    this.importExistingFlowService.setImportSwitchMethod(method);
  }

  onContinue(): void {
    this.importExistingFlowService.setImportSwitchMethod(this.importMethod());
    this.next.emit();
  }
}
