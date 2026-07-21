/**
 * Trigger a browser download of `json` as a `.json` file named
 * `<baseName>-<timestamp>.json`.
 */
export function downloadJsonFile(json: string, baseName: string): void {
  if (typeof window === 'undefined') return;

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${baseName}-${Date.now()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Open a file picker restricted to .json files and pass the selected file's
 * text content to `onLoad`.
 */
export function readJsonFile(onLoad: (content: string) => void): void {
  if (typeof document === 'undefined') return;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';

  input.addEventListener('change', (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev: ProgressEvent<FileReader>) => {
      const content = ev.target?.result;
      if (typeof content === 'string') onLoad(content);
    };
    reader.readAsText(file);
  });

  input.click();
}
