import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-mnemonic-words',
    imports: [CommonModule, FormsModule],
    templateUrl: './mnemonic-words.component.html',
    styleUrls: ['./mnemonic-words.component.scss']
})
export class MnemonicWordsComponent implements OnChanges {
  @Input() mnemonic: string = '';
  @Input() isReadOnly: boolean = false;
  @Input() wordCount: number = 12;
  @Output() mnemonicChange = new EventEmitter<string>();
  @ViewChildren('wordInput') wordInputs!: QueryList<ElementRef>;

  mnemonicWords: string[] = [];
  showCopiedMessage: boolean = false;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['mnemonic'].currentValue != this.getMnemonicString()) {
      if (this.mnemonic) {
        this.mnemonicWords = this.mnemonic.split(' ').filter(word => word.trim());
      } else {
        this.mnemonicWords = Array(this.wordCount).fill('');
      }
    }

    if (this.mnemonicWords.length != this.wordCount) {
      // Ensure array is always the correct length
      this.mnemonicWords = this.mnemonicWords.length < this.wordCount
        ? [...this.mnemonicWords, ...Array(this.wordCount - this.mnemonicWords.length).fill('')]
        : this.mnemonicWords.slice(0, this.wordCount);

      this.emitMnemonic();
    }
  }

  onKeyDown(index: number, event: KeyboardEvent) {
    if (event.ctrlKey) {
      return;
    }
    
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    if (event.key === ' ') {
      event.preventDefault();
      const nextIndex = index + 1;
      if (nextIndex < this.wordCount) {
        this.focusInput(nextIndex);
      }
      input.value = value.trim();
      return;
    }
    
    if (event.key === 'Backspace' && !value) {
      const prevIndex = index - 1;
      if (prevIndex >= 0) {
        this.focusInput(prevIndex);
      }
      return;
    }

    // Update the word value after a short delay to allow the input to update
    setTimeout(() => {
      this.mnemonicWords[index] = input.value;
      this.emitMnemonic();
    });
  }

  onPaste(event: ClipboardEvent, startIndex: number) {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') || '';
    const words = pastedText.trim().split(/\s+/);
    
    // Ensure we only take the exact number of words needed
    const wordsToUse = words.slice(0, this.wordCount - startIndex);
    
    // Fill in the words starting from the current index
    wordsToUse.forEach((word, i) => {
      const index = startIndex + i;
      this.mnemonicWords[index] = word;
    });
    
    this.emitMnemonic();
    
    // Focus the next empty input or the last input
    const nextEmptyIndex = this.mnemonicWords.findIndex((word, i) => i >= startIndex && !word.trim());
    const focusIndex = nextEmptyIndex >= 0 ? nextEmptyIndex : this.wordCount - 1;
    this.focusInput(focusIndex);
  }

  private focusInput(index: number) {
    setTimeout(() => {
      const inputs = this.wordInputs.toArray();
      if (inputs[index]) {
        inputs[index].nativeElement.focus();
      }
    });
  }

  emitMnemonic() {
    this.mnemonicChange.emit(this.getMnemonicString());
  }

  getMnemonicString() {
    return this.mnemonicWords.map(word => word.trim()).join(' ');
  }

  copyToClipboard() {
    navigator.clipboard.writeText(this.getMnemonicString()).then(() => {
      this.showCopiedMessage = true;
      setTimeout(() => {
        this.showCopiedMessage = false;
      }, 2000);
    });
  }

  getWordClass(index: number): string {
    if (this.isReadOnly) return 'word-item';
    return `word-item ${this.mnemonicWords[index] ? 'has-value' : ''}`;
  }

  trackByIndex(index: number, item: any): number {
    return index;
  }
} 