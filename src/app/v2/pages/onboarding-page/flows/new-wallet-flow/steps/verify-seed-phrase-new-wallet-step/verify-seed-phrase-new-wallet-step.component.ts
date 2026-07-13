import {
  Component,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KcInputComponent, KcButtonComponent } from '@kaspacom/ui-kit';
import { NewWalletFlowService } from '../../service/new-wallet-flow.service';

interface VerificationWordEntry {
  index: number;
  word: string;
  input: string;
}

@Component({
  selector: 'app-verify-seed-phrase-new-wallet-step',
  imports: [FormsModule, KcButtonComponent, KcInputComponent],
  templateUrl: './verify-seed-phrase-new-wallet-step.component.html',
  styleUrl: './verify-seed-phrase-new-wallet-step.component.scss',
})
export class VerifySeedPhraseNewWalletStepComponent implements OnInit {
  next = output<void>();
  previous = output<void>();

  private readonly newWalletFlowService = inject(NewWalletFlowService);

  seedWords = computed(() =>
    (this.newWalletFlowService.newWallet().seedPhrase || '')
      .split(' ')
      .filter((w) => !!w),
  );

  verificationWords = signal<VerificationWordEntry[]>([]);
  isVerified = signal<boolean>(false);

  ngOnInit(): void {
    this.generateVerificationWords();
  }

  private generateVerificationWords() {
    const words = this.seedWords();
    const count = Math.min(3, words.length);
    const indices = new Set<number>();
    while (indices.size < count) {
      indices.add(Math.floor(Math.random() * words.length));
    }
    const list: VerificationWordEntry[] = Array.from(indices).map((idx) => ({
      index: idx,
      word: words[idx],
      input: '',
    }));
    // Sort by index for a consistent order in UI
    list.sort((a, b) => a.index - b.index);
    this.verificationWords.set(list);
    this.checkVerification();
  }

  onInputChange(idx: number, value: string) {
    const list = [...this.verificationWords()];
    const entry = list[idx];
    list[idx] = { ...entry, input: value };
    this.verificationWords.set(list);
    this.checkVerification();
  }

  private checkVerification() {
    const ok = this.verificationWords().every(
      (item) => item.input.toLowerCase().trim() === item.word.toLowerCase(),
    );
    this.isVerified.set(ok);
  }

  async onContinue() {
    if (!this.isVerified()) {
      return;
    }

    this.next.emit();
  }
}
