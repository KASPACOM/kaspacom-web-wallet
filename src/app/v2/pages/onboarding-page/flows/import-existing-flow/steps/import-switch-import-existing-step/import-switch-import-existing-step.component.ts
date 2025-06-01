import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  HostListener,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import {
  KcButtonComponent,
  KcIconComponent,
  KcInputComponent,
} from 'kaspacom-ui';
import { ImportSwitchComponent } from './component/import-switch/import-switch.component';
import { ImportSwitchMethod } from './component/import-switch/import-switch-method.enum';
import { RadioInputComponent } from '../../../../../../shared/ui/input/radio/radio-input/radio-input.component';
import {
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ImportExistingFlowService } from '../../service/import-existing-flow.service';

@Component({
  selector: 'app-import-switch-import-existing-step',
  imports: [
    CommonModule,
    KcButtonComponent,
    ImportSwitchComponent,
    RadioInputComponent,
    KcInputComponent,
    ReactiveFormsModule,
    KcIconComponent,
  ],
  templateUrl: './import-switch-import-existing-step.component.html',
  styleUrl: './import-switch-import-existing-step.component.scss',
})
export class ImportSwitchImportExistingStepComponent {
  next = output<void>();
  previous = output<void>();

  ImportSwitchMethod = ImportSwitchMethod;

  private readonly fb = inject(FormBuilder);

  private readonly cdr = inject(ChangeDetectorRef);

  private readonly importExistingFlowService = inject(
    ImportExistingFlowService,
  );

  importMethod = signal<ImportSwitchMethod>(ImportSwitchMethod.SEED_PHRASE);

  seedPhraseForm = this.fb.group({ words: this.fb.array([]) });

  privateKeyForm = this.fb.group({
    privateKey: ['', [Validators.required]],
  });

  trackPhraseCount = signal<number>(1);

  get words() {
    return this.seedPhraseForm.get('words') as FormArray;
  }

  wordCount = signal<number>(12);

  wordSpots = computed(() =>
    Array.from({ length: this.wordCount() }, (_, i) => ''),
  );

  privateKeyFieldType = signal<'text' | 'password'>('password');

  privateKeyFieldIcon = computed(() =>
    this.privateKeyFieldType() === 'text' ? 'icon-eye-crossed' : 'icon-eye',
  );

  constructor() {
    for (let i = 0; i < this.wordCount(); i += 1) {
      this.words.push(this.fb.control('', [Validators.required]));
    }
  }

  reInitSeedPhraseForm() {
    this.trackPhraseCount.set(this.trackPhraseCount() + 1);
    this.words.clear();
    this.words.reset();
    this.cdr.detectChanges();
    for (let i = 0; i < this.wordCount(); i += 1) {
      this.words.push(this.fb.control('', [Validators.required]));
    }
  }

  onWordCountChange(count: number): void {
    this.wordCount.set(count);
    this.reInitSeedPhraseForm();
  }

  onImportMethodChange(method: ImportSwitchMethod): void {
    this.importMethod.set(method);
  }

  togglePrivateKeyVisibility(): void {
    this.privateKeyFieldType.set(
      this.privateKeyFieldType() === 'text' ? 'password' : 'text',
    );
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    if (this.importMethod() !== ImportSwitchMethod.SEED_PHRASE) {
      return;
    }
    const pastedText = event.clipboardData?.getData('text');
    if (!pastedText) {
      return;
    }
    const pastedWords = pastedText.split(/\s+/);
    let i = 0;
    for (const pastedWord of pastedWords) {
      if (i >= this.wordCount()) {
        break;
      }
      this.words.at(i).setValue(pastedWord.trim());
      i++;
    }
    console.log(this.words);
  }

  canSubmit(): boolean {
    if (this.importMethod() === ImportSwitchMethod.SEED_PHRASE) {
      return this.seedPhraseForm.valid;
    } else if (this.importMethod() === ImportSwitchMethod.PRIVATE_KEY) {
      return this.privateKeyForm.valid;
    }
    return false;
  }

  submitSeedPhrase() {
    let tmp = '';
    for (let word of this.words.controls) {
      tmp = `${tmp} ${word.value}`.trim();
    }
    this.importExistingFlowService.submitSeedPhraseStep(tmp);
    this.next.emit();
  }

  isPrivateKeyInvalid(controlName: string): boolean {
    const control = this.privateKeyForm.get(controlName);
    return control
      ? control.invalid && (control.dirty || control.touched)
      : false;
  }

  submitPrivateKey() {
    this.importExistingFlowService.submitPrivateKeyStep(
      this.privateKeyForm.value.privateKey!,
    );
    this.next.emit();
  }

  handleSubmit() {
    if (!this.canSubmit()) {
      return;
    }
    if (this.importMethod() === ImportSwitchMethod.SEED_PHRASE) {
      this.submitSeedPhrase();
    } else if (this.importMethod() === ImportSwitchMethod.PRIVATE_KEY) {
      this.submitPrivateKey();
    }
  }

  // onChangeSeedPhraseWord(value: string, idx: number) {
  //   this.wordSpots()[idx] = value;
  // }
}
