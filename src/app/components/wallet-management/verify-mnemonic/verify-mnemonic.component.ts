import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-verify-mnemonic',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './verify-mnemonic.component.html',
  styleUrls: ['./verify-mnemonic.component.scss']
})
export class VerifyMnemonicComponent {
  @Input() mnemonic: string = '';
  @Output() onVerified = new EventEmitter<void>();
  @Output() onBack = new EventEmitter<void>();

  wordsToVerify: { index: number; word: string; input: string }[] = [];
  isVerified: boolean = false;
  verificationError: string = '';

  ngOnInit() {
    this.generateVerificationWords();
  }

  private generateVerificationWords() {
    const words = this.mnemonic.split(' ');
    const numWordsToVerify = Math.min(3, words.length);
    const indices = new Set<number>();
    
    while (indices.size < numWordsToVerify) {
      indices.add(Math.floor(Math.random() * words.length));
    }

    this.wordsToVerify = Array.from(indices).map(index => ({
      index,
      word: words[index],
      input: ''
    }));
  }

  checkVerification() {
    this.isVerified = this.wordsToVerify.every(item => 
      item.input.toLowerCase().trim() === item.word.toLowerCase()
    );
    this.verificationError = this.isVerified ? '' : 'One or more words are incorrect';
  }
} 