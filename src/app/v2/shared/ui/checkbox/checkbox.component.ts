import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

type CheckboxSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-checkbox',
  standalone: true,
  imports: [],
  templateUrl: './checkbox.component.html',
  styleUrl: './checkbox.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckboxComponent {
  label = input<string>('');
  isChecked = input<boolean>(false);
  isDisabled = input<boolean>(false);
  size = input<CheckboxSize>('md');

  checkedChange = output<boolean>();

  private static nextInstanceId = 0;
  readonly inputId = `app-checkbox-${CheckboxComponent.nextInstanceId++}`;

  handleChange(event: Event): void {
    if (this.isDisabled()) return;
    this.checkedChange.emit((event.target as HTMLInputElement).checked);
  }
}
