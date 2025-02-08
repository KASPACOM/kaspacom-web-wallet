export type ActionDisplay = {
    title: string,
    subtitle?: string,
    rows: ActionDisplayRow[]
}

export type ActionDisplayRow = {
    fieldName: string,
    fieldValue: string;
    isCodeBlock?: boolean
}