import { CommonModule } from '@angular/common';
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
import {
  KcButtonComponent,
  KcInputComponent,
  KcSnackbarComponent,
  NotificationService,
} from 'kaspacom-ui';
import { RadioInputComponent } from '../../../../../../shared/ui/input/radio/radio-input/radio-input.component';
import { ImportExistingFlowService } from '../../service/import-existing-flow.service';
import { WalletService } from '../../../../../../../services/wallet.service';
import { ImportSwitchMethod } from '../import-switch-import-existing-step/component/import-switch/import-switch-method.enum';

@Component({
  selector: 'app-seed-phrase-import-existing-step',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    KcButtonComponent,
    KcInputComponent,
    KcSnackbarComponent,
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
    const isInput = target.tagName === 'INPUT' || target.closest('input') !== null;
    
    // Check if the paste is happening within our seed phrase form
    const isInSeedPhraseForm = target.closest('.seed-phrase-step__form') !== null;
    
    if (!isInput || !isInSeedPhraseForm) {
      return;
    }

    // Prevent default paste behavior
    event.preventDefault();
    event.stopPropagation();

    const pastedText = event.clipboardData?.getData('text');
    if (!pastedText) {
      return;
    }

    // Split the pasted text by whitespace and filter out empty strings
    const pastedWords = pastedText.trim().split(/\s+/).filter(word => word.length > 0);
    
    // Clear all inputs first
    for (let i = 0; i < this.wordCount(); i += 1) {
      this.words.at(i).setValue('');
    }

    // Fill inputs with pasted words
    for (let i = 0; i < pastedWords.length && i < this.wordCount(); i += 1) {
      this.words.at(i).setValue(pastedWords[i].trim());
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

    const derivedAddr = this.walletService.getWalletAddressFromMnemonic(
      mnemonic,
    );

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

