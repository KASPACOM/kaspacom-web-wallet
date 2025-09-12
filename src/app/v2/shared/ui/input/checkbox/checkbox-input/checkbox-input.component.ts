import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-checkbox-input',
  imports: [CommonModule],
  templateUrl: './checkbox-input.component.html',
  styleUrl: './checkbox-input.component.scss',
})
export class CheckboxInputComponent {
  checked = input.required<boolean>();
  checkedChange = output<boolean>();

  toggle(event: Event) {
    const input = event.target as HTMLInputElement;
    this.checkedChange.emit(input.checked);
  }
}
