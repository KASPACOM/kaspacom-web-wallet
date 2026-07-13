import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { KcInputComponent, KcButtonComponent, KcIconComponent, NotificationService } from '@kaspacom/ui-kit';
import { ImportExistingFlowService } from '../../service/import-existing-flow.service';
import { ImportSwitchMethod } from '../import-switch-import-existing-step/component/import-switch/import-switch-method.enum';

@Component({
  selector: 'app-private-key-import-existing-step',
  imports: [
    ReactiveFormsModule,
    KcButtonComponent,
    KcInputComponent,
    KcIconComponent,
  ],
  templateUrl: './private-key-import-existing-step.component.html',
  styleUrl: './private-key-import-existing-step.component.scss',
})
export class PrivateKeyImportExistingStepComponent {
  next = output<void>();
  previous = output<void>();

  skipPassword = input<boolean>(false);

  private readonly fb = inject(FormBuilder);
  private readonly importExistingFlowService = inject(
    ImportExistingFlowService,
  );
  private readonly notificationService = inject(NotificationService);

  privateKeyForm = this.fb.group({
    privateKey: [
      this.importExistingFlowService.model().privateKey,
      [Validators.required],
    ],
  });

  privateKeyFieldType = signal<'text' | 'password'>('password');

  privateKeyFieldIcon = computed(() =>
    this.privateKeyFieldType() === 'text' ? 'icon-eye-crossed' : 'icon-eye',
  );

  togglePrivateKeyVisibility(): void {
    this.privateKeyFieldType.set(
      this.privateKeyFieldType() === 'password' ? 'text' : 'password',
    );
  }

  isPrivateKeyInvalid(controlName: string): boolean {
    const control = this.privateKeyForm.get(controlName);
    return control
      ? control.invalid && (control.dirty || control.touched)
      : false;
  }

  async submit(): Promise<void> {
    if (this.privateKeyForm.invalid) {
      this.privateKeyForm.markAllAsTouched();
      return;
    }

    this.importExistingFlowService.submitPrivateKeyStep(
      this.privateKeyForm.value.privateKey!,
      ImportSwitchMethod.PRIVATE_KEY,
    );

    if (this.skipPassword()) {
      const result =
        await this.importExistingFlowService.finalSubmitSkipPassword();
      if (!result.success) {
        this.notificationService.error(
          'Error',
          result.error ?? 'Failed to import wallet.',
        );
        return;
      }
    }

    this.next.emit();
  }
}
