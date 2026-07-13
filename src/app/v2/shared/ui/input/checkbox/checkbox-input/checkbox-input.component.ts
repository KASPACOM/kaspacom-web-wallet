import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-checkbox-input',
  imports: [],
  templateUrl: './checkbox-input.component.html',
  styleUrl: './checkbox-input.component.scss',
})
export class CheckboxInputComponent {
  checked = input.required<boolean>();
  isDisabled = input<boolean>(false);
  checkedChange = output<boolean>();

  toggle(event: Event) {
    if (this.isDisabled()) {
      return;
    }
    const input = event.target as HTMLInputElement;
    this.checkedChange.emit(input.checked);
  }
}
