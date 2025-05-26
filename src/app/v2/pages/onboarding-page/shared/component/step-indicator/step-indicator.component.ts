import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-step-indicator',
  imports: [],
  templateUrl: './step-indicator.component.html',
  styleUrl: './step-indicator.component.scss',
})
export class StepIndicatorComponent {
  currentStep = input.required<number>();
  maxSteps = input.required<number>();
  steps = computed(() => Array.from({ length: this.maxSteps() }, (_, i) => i));
}
