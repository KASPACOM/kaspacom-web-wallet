import { Component, EventEmitter, TemplateRef, Output, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { DropdownOption, DropdownVariant } from '../dropdown-select.models';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, debounceTime, takeUntil } from 'rxjs';

@Component({
  selector: 'app-dropdown-options',
  standalone: true,
  imports: [CommonModule, NgClass, ReactiveFormsModule],
  templateUrl: './dropdown-options.component.html',
  styleUrls: ['./dropdown-options.component.scss']
})
export class DropdownOptionsComponent implements OnInit, OnDestroy {
  options: DropdownOption[] = [];
  filteredOptions: DropdownOption[] = [];
  selectedValue: any = null;
  variant: string = DropdownVariant.SECONDARY;
  optionsEllipsis: boolean = false;
  isFullscreenSelection: boolean = false;
  isSearchable: boolean = false;
  searchField: string = 'label';
  customTemplate: TemplateRef<any> | null = null;

  searchControl = new FormControl('');
  private destroy$ = new Subject<void>();

  @Output() optionSelected = new EventEmitter<DropdownOption>();
  @Output() closeRequested = new EventEmitter<void>();

  ngOnInit(): void {
    this.filteredOptions = [...this.options];

    if (this.isSearchable) {
      this.searchControl.valueChanges.pipe(
        debounceTime(128),
        takeUntil(this.destroy$)
      ).subscribe(value => {
        this.filterOptions(value || '');
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
    return this.selectedValue === option.value;
  }

  selectOption(option: DropdownOption): void {
    this.optionSelected.emit(option);
  }

  closeFullscreen(): void {
    this.closeRequested.emit();
  }

  getTypographyClass(): string {
    // Using the same typography class as the dropdown options
    return 'typo-text-3';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
