export type ActionDisplay = {
    title: string,
    subtitle?: string,
    rows: ActionDisplayRow[],
}

export type ActionDisplayRow = {
    fieldName: string,
    fieldValue: string,
    isCodeBlock?: boolean,
    inputField?: InputField, 
}

export type InputField = {
    fieldParam: string,
    fieldType: InputFieldType,
}

export enum InputFieldType {
    CHECKBOX = 'checkbox',
}