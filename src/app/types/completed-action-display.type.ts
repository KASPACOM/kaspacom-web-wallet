export type CompletedActionDisplay = {
    title: string,
    rows: CompletedActionDisplayRow[]
}

export type CompletedActionDisplayRow = {
    fieldName: string,
    fieldValue: string;
}