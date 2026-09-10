import { writeFileSync } from 'node:fs';

const sha = process.env.GITHUB_SHA?.trim();
if (!sha || !/^[0-9a-f]{7,40}$/i.test(sha)) {
  throw new Error('GITHUB_SHA must contain the checked-out commit SHA');
}

writeFileSync(
  new URL('../src/build-release.ts', import.meta.url),
  `export const BUILD_RELEASE = 'wallet@${sha}';\n`,
);
