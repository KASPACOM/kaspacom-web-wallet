import { Component, input } from '@angular/core';

@Component({
  selector: 'app-seed-phrase-word',
  imports: [],
  templateUrl: './seed-phrase-word.component.html',
  styleUrl: './seed-phrase-word.component.scss',
})
export class SeedPhraseWordComponent {
  word = input.required<string>();
}
