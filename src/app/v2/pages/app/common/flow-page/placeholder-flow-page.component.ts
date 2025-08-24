import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-placeholder-flow-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="placeholder-page">
      <p class="text-gray-60 typo-text-2">{{ text }}</p>
    </div>
  `,
})
export class PlaceholderFlowPageComponent {
  @Input() text: string = '';
}
