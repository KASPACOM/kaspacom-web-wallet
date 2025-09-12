import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-radio-input',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './radio-input.component.html',
  styleUrl: './radio-input.component.scss',
})
export class RadioInputComponent {
  name = input<string>();
  value = input<any>();

  control = input<FormControl>();
  selected = input<any>();

  selectedChange = output<any>();

  isChecked(): boolean {
    const control = this.control();
    const a = control ? control.value === this.value() : false;
    return control
      ? control.value === this.value()
      : this.selected() === this.value();
  }

  onSelect() {
    const control = this.control();
    if (control) {
      control.setValue(this.value());
    } else {
      this.selectedChange.emit(this.value());
    }
  }
}
