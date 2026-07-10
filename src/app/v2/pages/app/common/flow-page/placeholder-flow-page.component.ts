import { Component, input } from '@angular/core';

@Component({
  selector: 'app-placeholder-flow-page',
  standalone: true,
  imports: [],
  template: `
    <div class="placeholder-page">
      <p class="text-gray-60 typo-text-2">{{ text() }}</p>
    </div>
  `,
})
export class PlaceholderFlowPageComponent {
  readonly text = input<string>('');
}
