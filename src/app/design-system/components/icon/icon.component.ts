import {
  Component,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { DOCUMENT, NgClass, NgStyle } from '@angular/common';
import {ComponentSize} from '../../enums/sizing.enum';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'app-icon',
  templateUrl: './icon.component.html',
  styleUrls: ['./icon.component.scss'],
  standalone: true,
  imports: [NgStyle, NgClass],
})
export class IconComponent {
  @Input() iconClass!: string;
  @Input() public readonly disabled: boolean = false;
  @Input() size: ComponentSize = ComponentSize.SM;
  @Input() public readonly classes?: string;
  @Input() public readonly isDefaultColor: boolean = true;
  @Input() public color?: string;

  ComponentSize = ComponentSize;

  constructor(@Inject(DOCUMENT) private _document: Document) {}
}
