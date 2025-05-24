export interface DropdownOption {
  value: any;
  label: string;
  disabled?: boolean;
}

export enum DropdownVariant {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  TERTIARY = 'tertiary'
}
