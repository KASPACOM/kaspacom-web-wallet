import { Component, ElementRef, OnDestroy, ViewChild, computed, inject, input, output, ContentChild, TemplateRef, signal } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { DropdownMultiselectOptionsComponent } from './dropdown-multiselect-options/dropdown-multiselect-options.component';
import { DropdownMultiselectConfig } from './dropdown-multiselect.models';
import { DropdownOption, DropdownVariant } from '../dropdown-select/dropdown-select.models';
import { ComponentSize } from '../../enums/sizing.enum';

@Component({
  selector: 'app-dropdown-multiselect',
  standalone: true,
  imports: [CommonModule, NgClass, OverlayModule, FormsModule, ReactiveFormsModule],
  templateUrl: './dropdown-multiselect.component.html',
  styleUrls: ['./dropdown-multiselect.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: DropdownMultiselectComponent,
      multi: true
    }
  ]
})
export class DropdownMultiselectComponent implements ControlValueAccessor, OnDestroy {
  // Constants
  private readonly destroy$ = new Subject<void>();
  private readonly overlay = inject(Overlay);

  // Signals
  options = input<DropdownOption[]>([]);
  placeholder = input<string>('Select options');
  size = input<ComponentSize>(ComponentSize.MD);
  variant = input<DropdownVariant>(DropdownVariant.SECONDARY);
  isFullWidth = input<boolean>(false);
  isDisabled = input<boolean>(false);
  optionsEllipsis = input<boolean>(false);
  isFullscreenSelection = input<boolean>(false);

  // Multi-select specific inputs
  config = input<DropdownMultiselectConfig>({ minSelection: 0, maxSelection: Infinity });
  selectionCountText = input<string>('Selected items');

  // Search-related inputs
  isSearchable = input<boolean>(false);
  searchField = input<string>('label');

  // Custom item template
  @ContentChild('optionTemplate') optionTemplate: TemplateRef<any> | null = null;

  // Output signals
  valueChange = output<any[]>();
  searchChange = output<string>();
  clearAll = output<void>();

  // Other properties
  @ViewChild('dropdownTrigger') dropdownTrigger!: ElementRef;
  isOpen = false;
  selectedValues = signal<any[]>([]);
  private overlayRef: OverlayRef | null = null;
  private onChange: (value: any[]) => void = () => {};
  private onTouched: () => void = () => {};

  // We modify the isDisabled check to consider both the input signal and our internal state
  private _internalDisabled = false;

  // Helper method to check disabled state combining both sources
  isComponentDisabled(): boolean {
    return this.isDisabled() || this._internalDisabled;
  }

  // Check if we've reached max selections
  isMaxSelectionsReached(): boolean {
    return this.selectedValues().length >= (this.config().maxSelection || Infinity);
  }

  // Get the display value for the dropdown
  getDisplayValue(): string {
    const selectedCount = this.selectedValues().length;

    if (selectedCount === 0) {
      return this.placeholder();
    }

    if (selectedCount === 1) {
      const selectedOption = this.options().find(option => option.value === this.selectedValues()[0]);
      return selectedOption ? selectedOption.label : this.placeholder();
    }

    return `${selectedCount} ${this.selectionCountText()}`;
  }

  // Map dropdown size to typography class
  getTypographyClass(): string {
    const typographyMap: Record<ComponentSize, string> = {
      [ComponentSize.XS]: 'typo-text-1',
      [ComponentSize.SM]: 'typo-text-2',
      [ComponentSize.MD]: 'typo-text-3',
      [ComponentSize.LG]: 'typo-text-4',
      [ComponentSize.XLG]: 'typo-text-5'
    };

    return typographyMap[this.size()];
  }

  // Methods
  toggleDropdown(): void {
    if (this.isComponentDisabled()) {
      return;
    }

    this.isOpen ? this.closeDropdown() : this.openDropdown();
  }

  openDropdown(): void {
    this.onTouched();

    if (this.overlayRef) {
      return;
    }

    // Different overlay creation strategy based on mode
    if (this.isFullscreenSelection()) {
      this.openFullscreenDropdown();
    } else {
      this.openRegularDropdown();
    }

    this.isOpen = true;
  }

  private openRegularDropdown(): void {
    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.dropdownTrigger)
      .withPositions([
        {
          originX: 'start',
          originY: 'bottom',
          overlayX: 'start',
          overlayY: 'top',
          offsetY: 4
        },
        {
          originX: 'start',
          originY: 'top',
          overlayX: 'start',
          overlayY: 'bottom',
          offsetY: -4
        }
      ]);

    // Use overlay container class with animation
    const width = this.dropdownTrigger.nativeElement.offsetWidth;
    this.overlayRef = this.overlay.create({
      positionStrategy,
      width: width,
      minWidth: width, // Ensure minimum width
      scrollStrategy: this.overlay.scrollStrategies.close(),
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      panelClass: ['dropdown-overlay-panel', 'dropdown-animated-panel']
    });

    // Apply entrance animation
    const overlayElement = this.overlayRef.overlayElement;
    overlayElement.style.opacity = '0';
    overlayElement.style.transform = 'translateY(-10px) scale(0.98)';

    this.attachOptionsComponent();

    // Run the entrance animation after component is attached
    requestAnimationFrame(() => {
      overlayElement.style.transition = 'opacity 200ms cubic-bezier(0.25, 0.8, 0.25, 1), transform 200ms cubic-bezier(0.25, 0.8, 0.25, 1)';
      overlayElement.style.opacity = '1';
      overlayElement.style.transform = 'translateY(0) scale(1)';
    });
  }

  private openFullscreenDropdown(): void {
    const positionStrategy = this.overlay.position()
      .global()
      .centerHorizontally()
      .bottom();

    this.overlayRef = this.overlay.create({
      positionStrategy,
      width: '100%',
      height: '75vh',
      scrollStrategy: this.overlay.scrollStrategies.block(),
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      panelClass: ['dropdown-overlay-fullscreen', 'dropdown-animated-fullscreen']
    });

    // Apply fullscreen entrance animation - slide from bottom
    const overlayElement = this.overlayRef.overlayElement;
    overlayElement.style.opacity = '0';
    overlayElement.style.transform = 'translateY(100%)';

    // Add overflow hidden to prevent horizontal scrolling
    overlayElement.style.overflowX = 'hidden';

    this.attachOptionsComponent(true);

    // Run the entrance animation after component is attached
    requestAnimationFrame(() => {
      overlayElement.style.transition = 'opacity 300ms cubic-bezier(0.25, 0.8, 0.25, 1), transform 300ms cubic-bezier(0.25, 0.8, 0.25, 1)';
      overlayElement.style.opacity = '1';
      overlayElement.style.transform = 'translateY(0)';
    });
  }

  private attachOptionsComponent(isFullscreen = false): void {
    // Create and attach the dropdown options component
    const optionsPortal = new ComponentPortal(DropdownMultiselectOptionsComponent);
    const optionsRef = this.overlayRef!.attach(optionsPortal);

    // Configure options component
    optionsRef.instance.options = this.options();
    optionsRef.instance.selectedValues = this.selectedValues();
    optionsRef.instance.variant = this.variant();
    optionsRef.instance.optionsEllipsis = this.optionsEllipsis();
    optionsRef.instance.isFullscreenSelection = isFullscreen;
    optionsRef.instance.minSelection = this.config().minSelection || 0;
    optionsRef.instance.maxSelection = this.config().maxSelection || Infinity;
    optionsRef.instance.size = this.size();

    // Set search-related properties
    optionsRef.instance.isSearchable = this.isSearchable();
    optionsRef.instance.searchField = this.searchField();

    // Pass the custom template if available
    if (this.optionTemplate) {
      optionsRef.instance.customTemplate = this.optionTemplate;
    }

    // Handle option selection
    optionsRef.instance.optionSelected.subscribe((option: DropdownOption) => {
      this.toggleOption(option);
    });

    // Handle search change
    optionsRef.instance.searchChanged.subscribe((searchTerm: string) => {
      this.searchChange.emit(searchTerm);
    });

    // Handle clear all
    optionsRef.instance.clearAllRequested.subscribe(() => {
      this.clearAllSelections();
    });

    // Handle close button click for fullscreen mode
    optionsRef.instance.closeRequested?.subscribe(() => {
      this.closeDropdown();
    });

    // Handle backdrop click to close dropdown
    this.overlayRef!.backdropClick().pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.closeDropdown();
    });
  }

  clearAllSelections(): void {
    this.setValues([]);
    this.clearAll.emit();
  }

  closeDropdown(): void {
    if (this.overlayRef) {
      // Apply exit animation based on mode
      const overlayElement = this.overlayRef.overlayElement;

      if (this.isFullscreenSelection()) {
        // Fullscreen exit animation - slide down
        overlayElement.style.transition = 'opacity 250ms cubic-bezier(0.4, 0.0, 0.2, 1), transform 250ms cubic-bezier(0.4, 0.0, 0.2, 1)';
        overlayElement.style.opacity = '0';
        overlayElement.style.transform = 'translateY(100%)';
      } else {
        // Regular exit animation
        overlayElement.style.transition = 'opacity 180ms cubic-bezier(0.4, 0.0, 0.2, 1), transform 180ms cubic-bezier(0.4, 0.0, 0.2, 1)';
        overlayElement.style.opacity = '0';
        overlayElement.style.transform = 'translateY(-10px) scale(0.98)';
      }

      // Dispose after animation completes
      setTimeout(() => {
        if (this.overlayRef) {
          this.overlayRef.dispose();
          this.overlayRef = null;
        }
      }, this.isFullscreenSelection() ? 250 : 180);
    }

    this.isOpen = false;
  }

  toggleOption(option: DropdownOption): void {
    const currentValues = [...this.selectedValues()];
    const index = currentValues.findIndex(value => value === option.value);

    // If the option is already selected, remove it
    if (index !== -1) {
      currentValues.splice(index, 1);
      this.setValues(currentValues);
      return;
    }

    // Check if max selections is reached
    if (this.isMaxSelectionsReached()) {
      return;
    }

    // Add the option to selected values
    currentValues.push(option.value);
    this.setValues(currentValues);
  }

  setValues(values: any[]): void {
    this.selectedValues.set(values);
    this.onChange(values);
    this.valueChange.emit(values);
  }

  // ControlValueAccessor implementation
  writeValue(values: any[]): void {
    this.selectedValues.set(values || []);
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._internalDisabled = isDisabled;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.overlayRef) {
      this.overlayRef.dispose();
    }
  }
}
