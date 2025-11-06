import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { ImportExistingStep } from './import-existing-step.enum';
import { ImportExistingFlowService } from './service/import-existing-flow.service';
import {
  SlideDirection,
  slideAnimation,
} from '../../shared/animation/slide.animation';
import { StepIndicatorComponent } from '../../shared/component/step-indicator/step-indicator.component';
import { CommonModule } from '@angular/common';
import { ImportSwitchImportExistingStepComponent } from './steps/import-switch-import-existing-step/import-switch-import-existing-step.component';
import { CreatePinImportExistingStepComponent } from './steps/create-pin-import-existing-step/create-pin-import-existing-step.component';
import { SuccessImportExistingStepComponent } from './steps/success-import-existing-step/success-import-existing-step.component';
import { SeedPassphraseImportExistingStepComponent } from './steps/seed-passphrase-import-existing-step/seed-passphrase-import-existing-step.component';
import { ImportSwitchMethod } from './steps/import-switch-import-existing-step/component/import-switch/import-switch-method.enum';
import { SeedPhraseImportExistingStepComponent } from './steps/seed-phrase-import-existing-step/seed-phrase-import-existing-step.component';
import { PrivateKeyImportExistingStepComponent } from './steps/private-key-import-existing-step/private-key-import-existing-step.component';
import { BackupImportExistingStepComponent } from './steps/backup-import-existing-step/backup-import-existing-step.component';

@Component({
  selector: 'app-import-existing-flow',
  imports: [
    CommonModule,
    StepIndicatorComponent,
    ImportSwitchImportExistingStepComponent,
    SeedPhraseImportExistingStepComponent,
    SeedPassphraseImportExistingStepComponent,
    PrivateKeyImportExistingStepComponent,
    BackupImportExistingStepComponent,
    CreatePinImportExistingStepComponent,
    SuccessImportExistingStepComponent,
  ],
  animations: [slideAnimation],
  templateUrl: './import-existing-flow.component.html',
  styleUrl: './import-existing-flow.component.scss',
})
export class ImportExistingFlowComponent implements OnInit {
  readonly ImportExistingStep = ImportExistingStep;

  private readonly importExistingFlowService = inject(
    ImportExistingFlowService,
  );

  skipPassword = input<boolean>(false);

  private readonly baseStepOrder: ImportExistingStep[] = [
    ImportExistingStep.IMPORT_SWTICH,
    ImportExistingStep.ENTER_SEED_PHRASE,
    ImportExistingStep.SEED_PASSPHRASE,
    ImportExistingStep.ENTER_PRIVATE_KEY,
    ImportExistingStep.IMPORT_BACKUP,
    ImportExistingStep.CREATE_PIN,
    ImportExistingStep.SUCCESS,
  ];
  slideDirection = signal<SlideDirection>(SlideDirection.FORWARD);

  importStep = signal(ImportExistingStep.IMPORT_SWTICH);

  readonly visibleStepOrder = computed(() => {
    const method = this.importExistingFlowService.model().importSwitchMethod;
    const skipPassword = this.skipPassword();

    return this.baseStepOrder.filter((step) => {
      if (method === ImportSwitchMethod.SEED_PHRASE) {
        if (
          step === ImportExistingStep.ENTER_PRIVATE_KEY ||
          step === ImportExistingStep.IMPORT_BACKUP
        ) {
          return false;
        }
      } else if (method === ImportSwitchMethod.PRIVATE_KEY) {
        if (
          step === ImportExistingStep.ENTER_SEED_PHRASE ||
          step === ImportExistingStep.SEED_PASSPHRASE ||
          step === ImportExistingStep.IMPORT_BACKUP
        ) {
          return false;
        }
      } else if (method === ImportSwitchMethod.BACKUP) {
        if (
          step === ImportExistingStep.ENTER_SEED_PHRASE ||
          step === ImportExistingStep.SEED_PASSPHRASE ||
          step === ImportExistingStep.ENTER_PRIVATE_KEY
        ) {
          return false;
        }
      }

      if (skipPassword && step === ImportExistingStep.CREATE_PIN) {
        return false;
      }

      return true;
    });
  });

  readonly totalSteps = computed(() => this.visibleStepOrder().length);

  currentIndex = computed(() => {
    const index = this.visibleStepOrder().indexOf(this.importStep());
    return index === -1 ? 0 : index;
  });

  ngOnInit(): void {
    this.importExistingFlowService.init();
    this.importExistingFlowService.setSkipPassword(this.skipPassword());
  }

  next() {
    const steps = this.visibleStepOrder();
    if (!steps.length) {
      return;
    }
    const currentIndex = steps.indexOf(this.importStep());
    if (currentIndex === -1) {
      this.importStep.set(steps[0]);
      return;
    }
    if (currentIndex < steps.length - 1) {
      this.slideDirection.set(SlideDirection.FORWARD);
      this.importStep.set(steps[currentIndex + 1]);
    }
  }

  previous() {
    const steps = this.visibleStepOrder();
    if (!steps.length) {
      return;
    }
    const currentIndex = steps.indexOf(this.importStep());
    if (currentIndex === -1) {
      this.importStep.set(steps[0]);
      return;
    }
    if (currentIndex > 0) {
      this.slideDirection.set(SlideDirection.BACKWARD);
      this.importStep.set(steps[currentIndex - 1]);
    }
  }
}
