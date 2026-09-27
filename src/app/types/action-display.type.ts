export type ActionDisplay = {
  title: string;
  subtitle?: string;
  warning?: string;
  rows: ActionDisplayRow[];
};

export type ActionDisplayRow = {
  fieldName: string;
  fieldValue: string;
  isCodeBlock?: boolean;
  tone?: 'default' | 'warning';
  inputField?: InputField;
};

export type InputField = {
  fieldParam: string;
  fieldType: InputFieldType;
  requiredToApprove?: boolean;
};

export enum InputFieldType {
  CHECKBOX = 'checkbox',
}

export function areRequiredAcknowledgementsAccepted(
  display: ActionDisplay | undefined,
  values: Record<string, unknown>,
): boolean {
  return (display?.rows ?? [])
    .filter((row) => row.inputField?.requiredToApprove)
    .every((row) => values[row.inputField!.fieldParam] === true);
}
