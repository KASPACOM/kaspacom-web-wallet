import { Component, input } from '@angular/core';
import { ComponentSize } from '../../enums/sizing.enum';
import { NgClass } from '@angular/common';

@Component({
    selector: 'app-spinner',
    imports: [NgClass],
    template: `
    <div class="spinner" [ngClass]="size()"></div>
  `,
    styleUrls: ['./spinner.component.scss']
})
export class SpinnerComponent {
  size = input<ComponentSize>(ComponentSize.MD);
}
