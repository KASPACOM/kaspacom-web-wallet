import { Component, computed, inject, signal } from '@angular/core';
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

@Component({
  selector: 'app-import-existing-flow',
  imports: [
    CommonModule,
    StepIndicatorComponent,
    ImportSwitchImportExistingStepComponent,
    CreatePinImportExistingStepComponent,
    SuccessImportExistingStepComponent,
  ],
  animations: [slideAnimation],
  templateUrl: './import-existing-flow.component.html',
  styleUrl: './import-existing-flow.component.scss',
})
export class ImportExistingFlowComponent {
  readonly ImportExistingStep = ImportExistingStep;

  private readonly importExistingFlowService = inject(
    ImportExistingFlowService,
  );

  readonly stepOrder = [
    ImportExistingStep.IMPORT_SWTICH,
    ImportExistingStep.CREATE_PIN,
    ImportExistingStep.SUCCESS,
  ];
  slideDirection = signal<SlideDirection>(SlideDirection.FORWARD);

  importStep = signal(ImportExistingStep.IMPORT_SWTICH);

  currentIndex = computed(() => this.stepOrder.indexOf(this.importStep()));

  ngOnInit(): void {
    this.importExistingFlowService.init();
  }

  next() {
    const currentIndex = this.stepOrder.indexOf(this.importStep());
    if (currentIndex < this.stepOrder.length - 1) {
      this.slideDirection.set(SlideDirection.FORWARD);
      this.importStep.set(this.stepOrder[currentIndex + 1]);
    }
  }

  previous() {
    const currentIndex = this.stepOrder.indexOf(this.importStep());
    if (currentIndex > 0) {
      this.slideDirection.set(SlideDirection.BACKWARD);
      this.importStep.set(this.stepOrder[currentIndex - 1]);
    }
  }
}
