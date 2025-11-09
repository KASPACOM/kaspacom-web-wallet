import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  KcButtonComponent,
  KcIconComponent,
  KcInputComponent,
  KcSnackbarComponent,
  NotificationService,
} from '@kaspacom/ui';
import { ImportExistingFlowService } from '../../service/import-existing-flow.service';
import { WalletService } from '../../../../../../../services/wallet.service';

@Component({
  selector: 'app-seed-passphrase-import-existing-step',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    KcButtonComponent,
    KcInputComponent,
    KcIconComponent,
    KcSnackbarComponent,
  ],
  templateUrl: './seed-passphrase-import-existing-step.component.html',
  styleUrl: './seed-passphrase-import-existing-step.component.scss',
})
export class SeedPassphraseImportExistingStepComponent {
  next = output<void>();
  previous = output<void>();

  skipPassword = input<boolean>(false);

  private readonly fb = inject(FormBuilder);
  private readonly importExistingFlowService = inject(ImportExistingFlowService);
  private readonly walletService = inject(WalletService);
  private readonly notificationService = inject(NotificationService);

  passphraseForm = this.fb.group({
    seedPassphrase: [
      this.importExistingFlowService.model().seedPassphrase,
    ],
  });

  isSubmitting = signal(false);
  passphraseFieldType = signal<'password' | 'text'>('password');

  passphraseIcon = computed(() =>
    this.passphraseFieldType() === 'password' ? 'icon-eye' : 'icon-eye-crossed',
  );

  togglePassphraseVisibility(): void {
    if (this.passphraseFieldType() === 'password') {
      this.passphraseFieldType.set('text');
    } else {
      this.passphraseFieldType.set('password');
    }
  }

  async onSubmit(): Promise<void> {
    if (this.isSubmitting()) {
      return;
    }

    const passphrase =
      this.passphraseForm.value.seedPassphrase?.trim() ?? '';

    if (
      this.importExistingFlowService.model().seedPhrase &&
      !this.walletService.getWalletAddressFromMnemonic(
        this.importExistingFlowService.model().seedPhrase,
        passphrase || undefined,
      )
    ) {
      this.notificationService.error(
        'Invalid seed passphrase',
        'The combination of recovery phrase and passphrase is invalid. Please try again.',
      );
      return;
    }

    this.importExistingFlowService.submitSeedPassphraseStep(passphrase);

    if (this.skipPassword()) {
      this.isSubmitting.set(true);
      const result = await this.importExistingFlowService.finalSubmitSkipPassword();
      this.isSubmitting.set(false);

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

