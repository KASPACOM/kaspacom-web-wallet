import {
  ChangeDetectorRef,
  Component,
  HostListener,
  inject,
  output,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { KcInputComponent, KcButtonComponent, NotificationService } from '@kaspacom/ui-kit';
import { RadioInputComponent } from '../../../../../../shared/ui/input/radio/radio-input/radio-input.component';
import { ImportExistingFlowService } from '../../service/import-existing-flow.service';
import { WalletService } from '../../../../../../../services/wallet.service';
import { ImportSwitchMethod } from '../import-switch-import-existing-step/component/import-switch/import-switch-method.enum';

@Component({
  selector: 'app-seed-phrase-import-existing-step',
  imports: [
    ReactiveFormsModule,
    KcButtonComponent,
    KcInputComponent,
    RadioInputComponent,
  ],
  templateUrl: './seed-phrase-import-existing-step.component.html',
  styleUrl: './seed-phrase-import-existing-step.component.scss',
})
export class SeedPhraseImportExistingStepComponent {
  next = output<void>();
  previous = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly importExistingFlowService = inject(
    ImportExistingFlowService,
  );
  private readonly walletService = inject(WalletService);
  private readonly notificationService = inject(NotificationService);

  seedPhraseForm = this.fb.group({
    words: this.fb.array([]),
  });

  trackPhraseCount = signal<number>(1);
  wordCount = signal<number>(12);

  constructor() {
    const model = this.importExistingFlowService.model();
    this.wordCount.set(model.wordCount);
    const existingWords = model.seedPhrase.trim().split(/\s+/).filter(Boolean);
    for (let i = 0; i < this.wordCount(); i += 1) {
      const initialValue = existingWords[i] ?? '';
      this.words.push(this.fb.control(initialValue, [Validators.required]));
    }
  }

  get words(): FormArray {
    return this.seedPhraseForm.get('words') as FormArray;
  }

  onWordCountChange(count: number): void {
    this.wordCount.set(count);
    this.reInitSeedPhraseForm();
  }

  reInitSeedPhraseForm(): void {
    this.trackPhraseCount.set(this.trackPhraseCount() + 1);
    this.words.clear();
    this.words.reset();
    this.cdr.detectChanges();
    for (let i = 0; i < this.wordCount(); i += 1) {
      this.words.push(this.fb.control('', [Validators.required]));
    }
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    // Only handle paste events on input elements or their containers
    const target = event.target as HTMLElement;
    const inputElement =
      target.tagName === 'INPUT'
        ? (target as HTMLInputElement)
        : (target.closest('input') as HTMLInputElement);

    // Check if the paste is happening within our seed phrase form
    const isInSeedPhraseForm =
      target.closest('.seed-phrase-step__form') !== null;

    if (!inputElement || !isInSeedPhraseForm) {
      return;
    }

    // Prevent default paste behavior
    event.preventDefault();
    event.stopPropagation();

    const pastedText = event.clipboardData?.getData('text');
    if (!pastedText) {
      return;
    }

    // Find the index of the input where paste is happening
    // Try to get it from the input's id, or find it by traversing the DOM
    let startIndex = -1;

    // If id didn't work, find the input's position by looking for the kc-input parent
    if (startIndex === -1) {
      const kcInputElement = inputElement.closest('kc-input');
      if (kcInputElement) {
        // Find all kc-input elements in the form and get the index
        const formContainer = target.closest('.seed-phrase-step__inputs');
        if (formContainer) {
          const allKcInputs = Array.from(
            formContainer.querySelectorAll('kc-input'),
          );
          startIndex = allKcInputs.indexOf(kcInputElement);
        }
      }
    }

    // Fallback: try to find by formControlName attribute on parent
    if (startIndex === -1) {
      const formControlElement = inputElement.closest('[formControlName]');
      if (formControlElement) {
        const formControlName =
          formControlElement.getAttribute('formControlName');
        if (formControlName) {
          const nameIndex = parseInt(formControlName, 10);
          if (
            !isNaN(nameIndex) &&
            nameIndex >= 0 &&
            nameIndex < this.wordCount()
          ) {
            startIndex = nameIndex;
          }
        }
      }
    }

    if (startIndex === -1 || startIndex < 0 || startIndex >= this.wordCount()) {
      return;
    }

    // Split the pasted text by whitespace and filter out empty strings
    const pastedWords = pastedText
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);

    // Fill inputs starting from the paste location
    let lastFilledIndex = startIndex - 1;
    for (let i = 0; i < pastedWords.length; i += 1) {
      const targetIndex = startIndex + i;
      if (targetIndex < this.wordCount()) {
        this.words.at(targetIndex).setValue(pastedWords[i].trim());
        lastFilledIndex = targetIndex;
      }
    }

    // Focus on the next empty input after paste, or the next one after the last filled
    const nextIndex = lastFilledIndex + 1;
    if (nextIndex < this.wordCount()) {
      // Store the form container reference before setTimeout
      const formContainer = target.closest(
        '.seed-phrase-step__inputs',
      ) as HTMLElement;

      // Use setTimeout to ensure the DOM is updated before focusing
      setTimeout(() => {
        if (!formContainer) {
          return;
        }

        // Get all kc-input elements in order
        const allKcInputs = Array.from(
          formContainer.querySelectorAll('kc-input'),
        ) as HTMLElement[];
        if (allKcInputs[nextIndex]) {
          // Find the actual input element inside the kc-input component
          const nextInput = allKcInputs[nextIndex].querySelector(
            'input',
          ) as HTMLInputElement;
          if (nextInput) {
            nextInput.focus();
            // Also try to select the text if any
            nextInput.select();
          }
        }
      }, 0);
    }
  }

  submitSeedPhrase(): void {
    if (this.seedPhraseForm.invalid) {
      this.seedPhraseForm.markAllAsTouched();
      return;
    }

    let mnemonic = '';
    for (const word of this.words.controls) {
      mnemonic = `${mnemonic} ${word.value}`.trim();
    }

    mnemonic = mnemonic.toLowerCase();

    const derivedAddr =
      this.walletService.getWalletAddressFromMnemonic(mnemonic);

    if (!derivedAddr) {
      this.notificationService.error(
        'Invalid seed phrase',
        'Please enter a valid recovery phrase.',
      );
      return;
    }

    this.importExistingFlowService.submitSeedPhraseStep(
      mnemonic,
      this.wordCount(),
      ImportSwitchMethod.SEED_PHRASE,
    );

    this.next.emit();
  }
}
