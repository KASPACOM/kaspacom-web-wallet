// Once ssr.entry is configured, `ng build` names the browser shell
// index.csr.html (the file a real Node SSR server would use for CSR-mode
// routes) instead of index.html, and no longer emits a root index.html at
// all. Production is a static S3 + CloudFront deploy that never runs that
// Node server (see .github/workflows/deploy-*.yml) and expects the app's
// root shell at index.html, so copy it back to the filename static hosting
// actually serves.
import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const browserDir = join(__dirname, '..', 'dist/wallet-front-new/browser');
const csrIndex = join(browserDir, 'index.csr.html');
const index = join(browserDir, 'index.html');

if (existsSync(csrIndex)) {
  copyFileSync(csrIndex, index);
  console.log('Copied index.csr.html -> index.html for static hosting.');
}
