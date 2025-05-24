import { Component, EventEmitter, Input, Output, TemplateRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { DropdownOption } from '../../dropdown-select/dropdown-select.models';
import { debounceTime as rxjsDebounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ComponentSize } from '../../../enums/sizing.enum';
import { CheckboxComponent } from '../../checkbox/checkbox.component';
import { ButtonComponent, ButtonVariant } from '../../button/button.component';
import { trigger, state, style, animate, transition } from '@angular/animations';

@Component({
  selector: 'app-dropdown-multiselect-options',
  standalone: true,
  imports: [CommonModule, NgClass, ReactiveFormsModule, CheckboxComponent, ButtonComponent],
  templateUrl: './dropdown-multiselect-options.component.html',
  styleUrls: ['./dropdown-multiselect-options.component.scss'],
  animations: [
    trigger('enterLeave', [
      state('visible', style({
        opacity: 1,
        overflow: 'hidden',
        maxWidth: '100px',
        maxHeight: '32px',
        margin: '0 0 0 8px'
      })),
      state('hidden', style({
        opacity: 0,
        overflow: 'hidden',
        maxWidth: '0px',
        maxHeight: '0px',
        margin: '0',
        padding: '0'
      })),
      transition('hidden => visible', [
        animate('300ms ease-in-out')
      ]),
      transition('visible => hidden', [
        animate('300ms ease-in-out')
      ])
    ]),
    trigger('headerAnimation', [
      state('void', style({
        opacity: 0,
        height: '0px',
        minHeight: '0px',
        padding: '0px 16px',
        overflow: 'hidden',
        borderBottomWidth: '0px'
      })),
      state('*', style({
        opacity: 1,
        height: '*',
        minHeight: '42px',
        padding: '12px 16px',
        overflow: 'hidden',
        borderBottomWidth: '1px'
      })),
      transition('void <=> *', [
        animate('200ms ease-in-out')
      ])
    ])
  ]
})
export class DropdownMultiselectOptionsComponent implements OnInit, OnDestroy {
  options: DropdownOption[] = [];
  filteredOptions: DropdownOption[] = [];
  selectedValues: any[] = [];
  variant: ButtonVariant = 'secondary';
  optionsEllipsis: boolean = false;
  isFullscreenSelection: boolean = false;
  isSearchable: boolean = false;
  searchField: string = 'label';
  minSelection: number = 0;
  maxSelection: number = Infinity;
  customTemplate: TemplateRef<any> | null = null;
  size: ComponentSize = ComponentSize.MD;
  ComponentSize = ComponentSize;

  searchControl = new FormControl('');
  private destroy$ = new Subject<void>();

  @Output() optionSelected = new EventEmitter<DropdownOption>();
  @Output() closeRequested = new EventEmitter<void>();
  @Output() searchChanged = new EventEmitter<string>();
  @Output() clearAllRequested = new EventEmitter<void>();

  ngOnInit(): void {
    this.filteredOptions = [...this.options];

    if (this.isSearchable) {
      this.searchControl.valueChanges.pipe(
        debounceTime(128),
        takeUntil(this.destroy$)
      ).subscribe(value => {
        const searchTerm = value || '';
        this.filterOptions(searchTerm);
        this.searchChanged.emit(searchTerm);
      });
    }
  }

  filterOptions(searchText: string): void {
    if (!searchText.trim()) {
      this.filteredOptions = [...this.options];
      return;
    }

    const searchLower = searchText.toLowerCase();
    this.filteredOptions = this.options.filter(option => {
      const field = this.searchField === 'label' ? option.label :
                   (option as any)[this.searchField] || '';
      return String(field).toLowerCase().includes(searchLower);
    });
  }

  isSelected(option: DropdownOption): boolean {
    return this.selectedValues.includes(option.value);
  }

  selectOption(option: DropdownOption): void {
    this.optionSelected.emit(option);

    // Immediately update the local selection state for UI feedback
    const isCurrentlySelected = this.isSelected(option);
    if (isCurrentlySelected) {
      this.selectedValues = this.selectedValues.filter(val => val !== option.value);
    } else {
      if (this.selectedValues.length < this.maxSelection || this.maxSelection === Infinity) {
        this.selectedValues = [...this.selectedValues, option.value];
      }
    }
  }

  clearAll(): void {
    this.clearAllRequested.emit();
    // Immediately update the local state for visual feedback
    this.selectedValues = [];
  }

  closeFullscreen(): void {
    this.closeRequested.emit();
  }

  isMaxSelectionsReached(): boolean {
    return this.selectedValues.length >= this.maxSelection && this.maxSelection !== Infinity;
  }

  getTypographyClass(): string {
    const typographyMap: Record<ComponentSize, string> = {
      [ComponentSize.XS]: 'typo-text-1',
      [ComponentSize.SM]: 'typo-text-2',
      [ComponentSize.MD]: 'typo-text-3',
      [ComponentSize.LG]: 'typo-text-4',
      [ComponentSize.XLG]: 'typo-text-5'
    };

    return typographyMap[this.size];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
